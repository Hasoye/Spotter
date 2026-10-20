import { prisma } from "./prisma";
import {
  generateSessionToken,
  hashSessionToken,
  CreateSessionOptions,
} from "./session";

export { generateSessionToken, hashSessionToken };
export type { CreateSessionOptions };


/**
 * Cookie name for staff authentication.
 * Distinct from the member cookie ("spotter_session").
 */
export const STAFF_COOKIE_NAME = "spotter_staff_session";

/**
 * Default staff session lifetime: 24 hours (86,400,000 ms),
 * tailored for desk shift security.
 */
export const STAFF_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export interface IssuedStaffSession {
  id: string;
  staffId: string;
  rawToken: string;
  sessionToken: string;
  expiresAt: Date;
}

/**
 * Issues a fresh session token for the given staff member, hashes it,
 * persists the hashed token in StaffSession, and returns both raw and hashed tokens.
 * Only the SHA-256 hash is ever stored in PostgreSQL.
 */
export async function issueStaffSession(
  staffId: string,
  options?: CreateSessionOptions
): Promise<IssuedStaffSession> {
  const rawToken = generateSessionToken();
  const hashedToken = hashSessionToken(rawToken);
  const durationMs = options?.durationMs ?? STAFF_SESSION_DURATION_MS;
  const expiresAt = new Date(Date.now() + durationMs);

  const session = await prisma.staffSession.create({
    data: {
      staffId,
      sessionToken: hashedToken,
      expiresAt,
      ipAddress: options?.ipAddress || null,
      userAgent: options?.userAgent || null,
    },
  });

  return {
    id: session.id,
    staffId: session.staffId,
    rawToken,
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}

/**
 * Verifies and fetches an active, unrevoked, unexpired staff session by raw session token.
 * Performs staff validity check to ensure the staff member is active.
 */
export async function getValidStaffSession(rawToken: string) {
  if (!rawToken || typeof rawToken !== "string") return null;

  const hashedToken = hashSessionToken(rawToken);

  const session = await prisma.staffSession.findUnique({
    where: { sessionToken: hashedToken },
    include: { staff: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  // Staff account must be active
  if (!session.staff.isActive) {
    return null;
  }

  return session;
}

/**
 * Server-side staff session revocation (logout).
 * Hashes the incoming raw session token and marks the corresponding StaffSession as revoked.
 */
export async function revokeStaffSession(rawToken: string): Promise<boolean> {
  if (!rawToken || typeof rawToken !== "string") return false;

  const hashedToken = hashSessionToken(rawToken);

  try {
    const result = await prisma.staffSession.updateMany({
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
