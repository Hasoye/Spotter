import { NextResponse } from "next/server";
import { getValidMemberSession } from "../../../../lib/session";
import { logger } from "../../../../lib/logger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/spotter_session=([^;]+)/);
    const sessionToken = match ? decodeURIComponent(match[1]) : null;

    if (!sessionToken) {
      return NextResponse.json(
        { valid: false, error: "No session cookie present" },
        { status: 401 }
      );
    }

    const session = await getValidMemberSession(sessionToken);

    if (!session) {
      return NextResponse.json(
        { valid: false, error: "Session invalid, expired, or user locked" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        valid: true,
        member: {
          id: session.member.id,
          fullName: session.member.fullName,
          phoneNumber: session.member.phoneNumber,
          tier: session.member.tier,
          isActive: session.member.isActive,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      "Failed to verify session",
      { operation: "verifySession" },
      error
    );
    return NextResponse.json(
      { valid: false, error: "Failed to verify session" },
      { status: 500 }
    );
  }
}
