import { randomInt } from "crypto";
import { prisma } from "./prisma";

/**
 * Server-side member number generator for SPOTTER Gym.
 *
 * Format: SPT-YYYY-XXXX (e.g. SPT-2026-4821)
 * - 'SPT': Gym brand prefix (Spotter)
 * - 'YYYY': Four-digit calendar year of registration
 * - 'XXXX': Four-digit random numeric identifier with collision prevention
 *
 * Generation is strictly executed server-side. Uniqueness is verified against the
 * database before allocation and enforced by PostgreSQL unique index on Member(memberNumber).
 */
export async function generateServerMemberNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate 4-digit random suffix between 1000 and 9999
    const suffix = randomInt(1000, 10000);
    const candidate = `SPT-${year}-${suffix}`;

    // Verify candidate does not already exist in database
    const existing = await prisma.member.findUnique({
      where: { memberNumber: candidate },
    });

    if (!existing) {
      return candidate;
    }
  }

  // Fallback: If 10 random collisions occur, use high-resolution timestamp suffix
  const timestampSuffix = Date.now().toString().slice(-6);
  return `SPT-${year}-${timestampSuffix}`;
}
