import { createHash, randomBytes, randomUUID } from "crypto";
import { prisma } from "./prisma";

/**
 * Default session lifetime in milliseconds (7 days).
 */
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreateSessionOptions {
  ipAddress?: string | null;
  userAgent?: string | null;
  durationMs?: number;
}

export interface IssuedSession {
  id: string;
  memberId: string;
  rawToken: string;
  sessionToken: string;
  expiresAt: Date;
}

/**
 * Generates a fresh cryptographically secure random session token.
 * Uses 256-bit cryptographically secure hex entropy with UUID prefix.
 */
export function generateSessionToken(): string {
  const uuid = randomUUID();
  const entropy = randomBytes(16).toString("hex");
  return `${uuid}-${entropy}`;
}

/**
 * Hashes a plaintext session token using SHA-256 for secure database storage.
 * The client browser receives the raw token in an HTTP-only cookie,
 * while the database reflects only the one-way cryptographic SHA-256 hash.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Issues a fresh session token for the given member, hashes it,
 * persists the hashed token in MemberSession, and returns both raw and hashed tokens.
 */
export async function issueMemberSession(
  memberId: string,
  options?: CreateSessionOptions
): Promise<IssuedSession> {
  const rawToken = generateSessionToken();
  const hashedToken = hashSessionToken(rawToken);
  const durationMs = options?.durationMs ?? SESSION_DURATION_MS;
  const expiresAt = new Date(Date.now() + durationMs);

  const session = await prisma.memberSession.create({
    data: {
      memberId,
      sessionToken: hashedToken,
      expiresAt,
      ipAddress: options?.ipAddress || null,
      userAgent: options?.userAgent || null,
    },
  });

  return {
    id: session.id,
    memberId: session.memberId,
    rawToken,
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}

/**
 * Verifies and fetches an active, unrevoked, unexpired member session by raw session token.
 * Performs user validity check to ensure the user is still active and not banned or locked.
 */
export async function getValidMemberSession(rawToken: string) {
  if (!rawToken || typeof rawToken !== "string") return null;

  const hashedToken = hashSessionToken(rawToken);

  const session = await prisma.memberSession.findUnique({
    where: { sessionToken: hashedToken },
    include: { member: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  // Check user validity: user must be active and not banned/deactivated/locked
  if (!session.member.isActive || session.member.deactivatedAt) {
    return null;
  }

  return session;
}

/**
 * Server-side session revocation (logout).
 * Hashes the incoming raw session token and marks the corresponding MemberSession as revoked.
 */
export async function revokeMemberSession(rawToken: string): Promise<boolean> {
  if (!rawToken || typeof rawToken !== "string") return false;

  const hashedToken = hashSessionToken(rawToken);

  try {
    const result = await prisma.memberSession.updateMany({
      where: {
        sessionToken: hashedToken,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}
