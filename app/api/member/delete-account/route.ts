import { NextResponse } from "next/server";
import { getValidMemberSession } from "../../../../lib/session";
import { verifyPassword } from "../../../../lib/password";
import { scheduleMemberAccountDeletion } from "../../../../lib/account-deletion";
import { logger } from "../../../../lib/logger";
import { z } from "zod";

const deleteAccountSchema = z.object({
  password: z.string().trim().min(1, "Password is required to confirm deletion"),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate member exclusively from server session cookie (no external memberId parameter permitted)
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/spotter_session=([^;]+)/);
    const sessionToken = match ? decodeURIComponent(match[1]) : null;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Authentication required to request account deletion." },
        { status: 401 }
      );
    }

    const session = await getValidMemberSession(sessionToken);

    if (!session || !session.member) {
      return NextResponse.json(
        { error: "Session invalid or expired. Please log in again." },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json().catch(() => ({}));
    const parseResult = deleteAccountSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { password } = parseResult.data;

    // 3. Confirm password using Argon2id
    if (!session.member.passwordHash) {
      return NextResponse.json(
        { error: "Account credentials invalid." },
        { status: 400 }
      );
    }

    const isPasswordValid = await verifyPassword(
      session.member.passwordHash,
      password
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Incorrect password. Account deletion cancelled." },
        { status: 401 }
      );
    }

    // 4. Soft delete: schedule for deletion and revoke all active sessions
    const { scheduledPurgeDate } = await scheduleMemberAccountDeletion(
      session.member.id
    );

    const response = NextResponse.json(
      {
        success: true,
        message:
          "Your account has been scheduled for deletion. You have a 30-day grace period before data is permanently purged.",
        scheduledPurgeDate: scheduledPurgeDate.toISOString(),
      },
      { status: 200 }
    );

    // Clear session cookie immediately
    response.cookies.set("spotter_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });

    return response;
  } catch (error) {
    logger.error(
      "Failed to process account deletion request",
      { operation: "deleteAccount" },
      error
    );

    return NextResponse.json(
      { error: "An unexpected error occurred while scheduling account deletion." },
      { status: 500 }
    );
  }
}
