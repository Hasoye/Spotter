import { NextResponse } from "next/server";
import {
  getValidStaffSession,
  STAFF_COOKIE_NAME,
} from "../../../../../lib/staff-session";
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

    const session = await getValidStaffSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { valid: false, error: "Staff session invalid, expired, or staff deactivated" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        staff: {
          id: session.staff.id,
          fullName: session.staff.fullName,
          email: session.staff.email,
          phoneNumber: session.staff.phoneNumber,
          role: session.staff.role,
          isActive: session.staff.isActive,
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
