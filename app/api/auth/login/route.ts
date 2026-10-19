import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../../lib/logger";
import { loginSchema } from "../../../../lib/validations";
import { verifyPassword } from "../../../../lib/password";
import {
  getClientIp,
  checkRateLimit,
  getRateLimitHeaders,
} from "../../../../lib/rate-limit";
import { issueMemberSession } from "../../../../lib/session";
import { getAccountDeletionStatus } from "../../../../lib/account-deletion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Server-side Rate Limiting (5 attempts max before expensive Argon2id verification)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`login:${clientIp}`, 5);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.errors[0]?.message || "Invalid input data";
      return NextResponse.json(
        { error: firstError, details: result.error.flatten() },
        {
          status: 400,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    const { phoneNumber, password } = result.data;

    // 2. Look up member by phone number (with fallback for cleaned format and local/international variations)
    const cleanedPhone = phoneNumber.replace(/[\s-]/g, "");
    let member = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    if (!member && cleanedPhone !== phoneNumber) {
      member = await prisma.member.findUnique({
        where: { phoneNumber: cleanedPhone },
      });
    }

    if (!member) {
      let alternatePhone: string | null = null;
      if (cleanedPhone.startsWith("+234") && cleanedPhone.length === 14) {
        alternatePhone = "0" + cleanedPhone.slice(4);
      } else if (cleanedPhone.startsWith("0") && cleanedPhone.length === 11) {
        alternatePhone = "+234" + cleanedPhone.slice(1);
      } else if (cleanedPhone.startsWith("234") && cleanedPhone.length === 13) {
        alternatePhone = "0" + cleanedPhone.slice(3);
      }

      if (alternatePhone) {
        member = await prisma.member.findUnique({
          where: { phoneNumber: alternatePhone },
        });
      }
    }

    // Generic error for invalid credentials if member not found or has no password hash
    if (!member || !member.passwordHash) {
      return NextResponse.json(
        { error: "Invalid phone number or password. Please try again." },
        {
          status: 401,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 3. Verify password against stored Argon2id hash (normalizes leading/trailing spaces)
    const isPasswordValid = await verifyPassword(member.passwordHash, password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid phone number or password. Please try again." },
        {
          status: 401,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 4. Check account deactivation and deletion grace period status
    if (member.deactivatedAt) {
      const deletionStatus = getAccountDeletionStatus(member.deactivatedAt);
      const errorMessage = deletionStatus.isGracePeriodExpired
        ? "This account has been permanently deactivated."
        : `This account is scheduled for deletion (${deletionStatus.daysRemaining} days remaining in grace period). Please contact gym staff to restore your account.`;

      return NextResponse.json(
        { error: errorMessage },
        {
          status: 403,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 5. For every login request, check user phone number verification status
    if (!member.isActive) {
      return NextResponse.json(
        { error: "Phone number is not verified. Please verify your phone number before logging in." },
        {
          status: 403,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 6. Issue a fresh session token on every sign in
    const userAgent = request.headers.get("user-agent") || undefined;
    const session = await issueMemberSession(member.id, {
      ipAddress: clientIp,
      userAgent,
    });

    // Prepare response with safe public member data and fresh raw session token
    const response = NextResponse.json(
      {
        success: true,
        sessionToken: session.rawToken,
        member: {
          id: member.id,
          fullName: member.fullName,
          phoneNumber: member.phoneNumber,
          tier: member.tier,
          balanceKobo: member.balanceKobo,
          isPhoneVerified: member.isActive,
          expiresAt: member.expiresAt ? member.expiresAt.toISOString() : null,
          createdAt: member.createdAt.toISOString(),
        },
      },
      {
        status: 200,
        headers: getRateLimitHeaders(rateLimit),
      }
    );

    // Set server-side HTTP-only session cookie with the raw session token (hashed in DB)
    response.cookies.set("spotter_session", session.rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });

    // Existing members bypass onboarding on login
    response.cookies.set("spotter_onboarded", "true", {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    logger.error(
      "Failed to process login request",
      {
        operation: "login",
      },
      error
    );

    return NextResponse.json(
      { error: "An unexpected error occurred during login. Please try again." },
      { status: 500 }
    );
  }
}
