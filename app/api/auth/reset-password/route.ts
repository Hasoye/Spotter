import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../../lib/logger";
import { resetPasswordSchema } from "../../../../lib/validations";
import { hashPassword } from "../../../../lib/password";
import {
  getClientIp,
  checkRateLimit,
  getRateLimitHeaders,
} from "../../../../lib/rate-limit";
import { checkPwnedPassword } from "../../../../lib/hibp";

export async function POST(request: Request) {
  try {
    // 1. Server-side Rate Limiting (5 attempts max per IP within 15 minutes)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`reset-password:${clientIp}`, 5);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many password reset attempts. Please try again later." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    const body = await request.json();
    const result = resetPasswordSchema.safeParse(body);

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

    const { phoneNumber, otpCode, password } = result.data;

    // 2. Simulated SMS OTP check (for MVP development workflow)
    if (otpCode !== "123456" && otpCode !== "000000") {
      return NextResponse.json(
        { error: "Invalid verification code. Please check your SMS and try again." },
        {
          status: 400,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 3. Find member by phone number
    const member = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Unable to reset password. Please check your phone number and try again." },
        {
          status: 400,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    if (member.deactivatedAt) {
      return NextResponse.json(
        { error: "This account has been deactivated. Please contact gym staff." },
        {
          status: 403,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 4. Have I Been Pwned (HIBP) Breached Password Protection (k-anonymity SHA-1 prefix check)
    const hibpResult = await checkPwnedPassword(password);
    if (hibpResult.status === "BREACHED") {
      return NextResponse.json(
        { error: "This password has appeared in known data breaches. Please choose a different password." },
        {
          status: 400,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    if (hibpResult.status === "ERROR") {
      // Deliberate fail-closed policy for password reset
      return NextResponse.json(
        { error: hibpResult.error },
        {
          status: 503,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 5. Hash normalized password securely using Argon2id with unique salt
    const passwordHash = await hashPassword(password);

    // 6. Update Member password hash in database
    await prisma.member.update({
      where: { phoneNumber },
      data: { passwordHash },
    });

    // 7. Clear existing session cookie to prevent stale authenticated sessions
    const response = NextResponse.json(
      {
        success: true,
        message: "Password reset successful. Please log in with your new password.",
      },
      {
        status: 200,
        headers: getRateLimitHeaders(rateLimit),
      }
    );

    response.cookies.set("spotter_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    logger.error(
      "Failed to process password reset completion",
      {
        operation: "resetPasswordComplete",
      },
      error
    );

    return NextResponse.json(
      { error: "An unexpected error occurred during password reset. Please try again." },
      { status: 500 }
    );
  }
}
