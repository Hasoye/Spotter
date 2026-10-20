import { NextResponse } from "next/server";
import { STAFF_COOKIE_NAME } from "../../../../../lib/staff-session";
import { requireStaffRole, StaffRole } from "../../../../../lib/rbac";
import { logger } from "../../../../../lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const regex = new RegExp(`${STAFF_COOKIE_NAME}=([^;]+)`);
    const match = cookieHeader.match(regex);
    const sessionToken = match ? decodeURIComponent(match[1]) : null;

    if (!sessionToken) {
      return NextResponse.json(
        { valid: false, error: "No staff session cookie present" },
        { status: 401 }
      );
    }

    const auth = await requireStaffRole(sessionToken, [
      StaffRole.FRONT_DESK,
      StaffRole.OWNER,
    ]);

    if (!auth.authorized) {
      return NextResponse.json(
        { valid: false, error: auth.error, reason: auth.reason },
        { status: auth.status }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        staff: {
          id: auth.staff.id,
          fullName: auth.staff.fullName,
          email: auth.staff.email,
          phoneNumber: auth.staff.phoneNumber,
          role: auth.staff.role,
          isActive: auth.staff.isActive,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      "Failed to verify staff session",
      { operation: "verifyStaffSession" },
      error
    );
    return NextResponse.json(
      { valid: false, error: "Failed to verify staff session" },
      { status: 500 }
    );
  }
}
