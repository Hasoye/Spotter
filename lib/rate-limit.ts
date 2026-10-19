/**
 * In-memory sliding-window rate limiter for authentication endpoints.
 * Tracks attempts per IP and operation without external dependencies.
 */

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in ms
}

// In-memory store: key -> array of attempt timestamps (ms)
const rateLimitStore = new Map<string, number[]>();

/**
 * Default window: 15 minutes (900,000 ms)
 * Default maximum attempts: 5
 */
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_AUTH_MAX_ATTEMPTS = 5;

/**
 * Extracts client IP from request headers safely.
 * Checks standard proxy headers in order of priority, falling back to localhost.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp?.trim()) return cfConnectingIp.trim();

  return "127.0.0.1";
}

/**
 * Checks and updates rate limit for a given key using a sliding window.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = DEFAULT_AUTH_MAX_ATTEMPTS,
  windowMs: number = DEFAULT_RATE_LIMIT_WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const existingTimestamps = rateLimitStore.get(key) || [];
  // Filter out expired timestamps outside the sliding window
  const activeTimestamps = existingTimestamps.filter((ts) => ts > windowStart);

  if (activeTimestamps.length >= maxAttempts) {
    const oldestTimestamp = activeTimestamps[0] ?? now;
    const resetAt = oldestTimestamp + windowMs;
    rateLimitStore.set(key, activeTimestamps);

    return {
      success: false,
      limit: maxAttempts,
      remaining: 0,
      resetAt,
    };
  }

  // Record this attempt
  activeTimestamps.push(now);
  rateLimitStore.set(key, activeTimestamps);

  const oldestTimestamp = activeTimestamps[0] ?? now;
  const resetAt = oldestTimestamp + windowMs;
  const remaining = Math.max(0, maxAttempts - activeTimestamps.length);

  return {
    success: true,
    limit: maxAttempts,
    remaining,
    resetAt,
  };
}

/**
 * Generates standard rate limit HTTP response headers.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const now = Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.success) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  return headers;
}

/**
 * Resets the in-memory store. Used primarily for unit and integration testing.
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}
