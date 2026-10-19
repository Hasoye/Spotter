import { hash, verify } from "@node-rs/argon2";

/**
 * Numeric code for Argon2id algorithm (RFC 9106 / @node-rs/argon2).
 * Using constant numeric value avoids TS2748 isolatedModules ambient const enum error.
 */
const ARGON2ID_ALGORITHM = 2;

/**
 * Normalizes password by trimming leading and trailing whitespace while preserving internal spaces.
 */
export function normalizePassword(password: string): string {
  return password.trim();
}

/**
 * Hashes a plaintext password using Argon2id with a cryptographically secure random salt.
 * Normalizes leading/trailing whitespace prior to hashing.
 */
export async function hashPassword(password: string): Promise<string> {
  const normalized = normalizePassword(password);
  return hash(normalized, {
    algorithm: ARGON2ID_ALGORITHM,
  });
}

/**
 * Securely verifies a plaintext password against an Argon2id hash.
 * Normalizes leading/trailing whitespace prior to verification.
 */
export async function verifyPassword(
  hashedPassword: string,
  plainPassword: string
): Promise<boolean> {
  const normalized = normalizePassword(plainPassword);
  return verify(hashedPassword, normalized);
}
