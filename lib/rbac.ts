import { StaffRole, Staff, StaffSession } from "@prisma/client";
import { prisma } from "./prisma";
import { hashSessionToken, STAFF_COOKIE_NAME } from "./staff-session";

export { StaffRole };

/**
 * Staff roles permitted to access front desk / receptionist functionality.
 * Both FRONT_DESK and OWNER are authorized.
 */
export const RECEPTIONIST_ROLES: StaffRole[] = [
  StaffRole.FRONT_DESK,
  StaffRole.OWNER,
];

export type AuthFailureReason =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "SESSION_REVOKED"
  | "STAFF_INACTIVE"
  | "FORBIDDEN";

export type AuthSuccessResult = {
  authorized: true;
  staff: Staff;
  session: StaffSession;
};

export type AuthFailureResult = {
  authorized: false;
  reason: AuthFailureReason;
  status: 401 | 403;
  error: string;
};

export type AuthResult = AuthSuccessResult | AuthFailureResult;

/**
 * Authoritative Server-Side RBAC Checker.
 *
 * Enforces role-based access control based STRICTLY on the Staff.role persisted
 * in the PostgreSQL database.
 *
 * Security Guarantees:
 * 1. The client-provided session token is hashed and verified against StaffSession in the DB.
 * 2. Revoked, expired, or inactive accounts are immediately rejected.
 * 3. The staff member's role is read directly from PostgreSQL (Staff.role), never from
 *    the client, cookies, query parameters, request bodies, or headers.
 * 4. Any client attempting to claim a higher role (e.g. role=OWNER) is completely ignored.
 *
 * @param sessionToken Raw session token string from HTTP-only cookie.
 * @param allowedRoles Array of permitted StaffRoles (defaults to FRONT_DESK and OWNER).
 */
export async function requireStaffRole(
  sessionToken: string | null | undefined,
  allowedRoles: StaffRole[] = RECEPTIONIST_ROLES
): Promise<AuthResult> {
  if (!sessionToken || typeof sessionToken !== "string" || !sessionToken.trim()) {
    return {
      authorized: false,
      reason: "UNAUTHENTICATED",
      status: 401,
      error: "Unauthorized. Staff session cookie required.",
    };
  }

  const hashedToken = hashSessionToken(sessionToken.trim());

  const session = await prisma.staffSession.findUnique({
    where: { sessionToken: hashedToken },
    include: { staff: true },
  });

  if (!session) {
    return {
      authorized: false,
      reason: "SESSION_EXPIRED",
      status: 401,
      error: "Unauthorized. Staff session is invalid or does not exist.",
    };
  }

  if (session.revokedAt) {
    return {
      authorized: false,
      reason: "SESSION_REVOKED",
      status: 401,
      error: "Unauthorized. Staff session has been revoked.",
    };
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return {
      authorized: false,
      reason: "SESSION_EXPIRED",
      status: 401,
      error: "Unauthorized. Staff session has expired.",
    };
  }

  // Verify staff active status from database
  if (!session.staff.isActive) {
    return {
      authorized: false,
      reason: "STAFF_INACTIVE",
      status: 403,
      error: "Forbidden. Staff account is deactivated.",
    };
  }

  // Server-authoritative role check against database persisted Staff.role
  const persistedRole = session.staff.role;

  if (!allowedRoles.includes(persistedRole)) {
    return {
      authorized: false,
      reason: "FORBIDDEN",
      status: 403,
      error: `Forbidden. Role '${persistedRole}' is not authorized for this operation.`,
    };
  }

  return {
    authorized: true,
    staff: session.staff,
    session,
  };
}

/**
 * Extracts staff session cookie from a Request and performs database-backed RBAC check.
 */
export async function requireStaffRoleFromRequest(
  request: Request,
  allowedRoles: StaffRole[] = RECEPTIONIST_ROLES
): Promise<AuthResult> {
  const cookieHeader = request.headers.get("cookie") || "";
  const regex = new RegExp(`${STAFF_COOKIE_NAME}=([^;]+)`);
  const match = cookieHeader.match(regex);
  const token = match ? decodeURIComponent(match[1]) : null;

  return requireStaffRole(token, allowedRoles);
}
