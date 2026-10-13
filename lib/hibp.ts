import { createHash } from "crypto";
import { normalizePassword } from "./password";
import { logger } from "./logger";

export const HIBP_RANGE_API_URL = "https://api.pwnedpasswords.com/range";
export const HIBP_REQUEST_TIMEOUT_MS = 3500;

export type HibpCheckResult =
  | { status: "SAFE" }
  | { status: "BREACHED" }
  | { status: "ERROR"; error: string };

/**
 * Computes the uppercase hexadecimal SHA-1 hash of the normalized password.
 * Used exclusively for k-anonymity range lookup against Have I Been Pwned.
 */
export function computePasswordSha1(password: string): string {
  const normalized = normalizePassword(password);
  return createHash("sha1").update(normalized, "utf8").digest("hex").toUpperCase();
}

/**
 * Checks whether a password has appeared in known data breaches using HIBP's k-anonymity API.
 *
 * Privacy and security guarantees:
 * 1. Plaintext passwords never leave the application server.
 * 2. Only the first 5 characters (prefix) of the SHA-1 hash are transmitted.
 * 3. The full SHA-1 hash is never sent across the network.
 * 4. The comparison between the remaining 35 characters (suffix) and breach records happens locally.
 *
 * Failure Policy (Fail-Closed):
 * If HIBP times out, fails, or returns an error, the check returns status: "ERROR".
 * For new password creation, failing closed prevents compromised passwords from slipping through
 * during upstream API downtime.
 */
export async function checkPwnedPassword(
  password: string,
  fetchFn: typeof fetch = fetch
): Promise<HibpCheckResult> {
  const sha1 = computePasswordSha1(password);
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HIBP_REQUEST_TIMEOUT_MS);

    const response = await fetchFn(`${HIBP_RANGE_API_URL}/${prefix}`, {
      method: "GET",
      headers: {
        "User-Agent": "SPOTTER-Gym-Auth/1.0",
        "Add-Padding": "true", // Requests padded response to prevent response-length analysis
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error(
        "HIBP range API returned non-OK response",
        {
          operation: "hibpCheck",
          statusCode: response.status,
          prefix,
        }
      );
      return {
        status: "ERROR",
        error: "Unable to verify password security at this time. Please try again shortly.",
      };
    }

    const text = await response.text();
    const lines = text.split(/\r?\n/);

    // Look for matching suffix locally
    for (const line of lines) {
      const [hashSuffix] = line.split(":");
      if (hashSuffix && hashSuffix.trim().toUpperCase() === suffix) {
        return { status: "BREACHED" };
      }
    }

    return { status: "SAFE" };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.toLowerCase().includes("timeout"));

    logger.error(
      isTimeout ? "HIBP range API request timed out" : "HIBP range API request failed",
      {
        operation: "hibpCheck",
        isTimeout,
        prefix,
      },
      err
    );

    return {
      status: "ERROR",
      error: "Unable to verify password security at this time. Please try again shortly.",
    };
  }
}
