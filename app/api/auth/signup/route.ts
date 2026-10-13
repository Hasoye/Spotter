import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../../lib/logger";
import { signupSchema } from "../../../../lib/validations";
import { hashPassword } from "../../../../lib/password";
import {
  getClientIp,
  checkRateLimit,
  getRateLimitHeaders,
} from "../../../../lib/rate-limit";
import { checkPwnedPassword } from "../../../../lib/hibp";

export async function POST(request: Request) {
  try {
    // 1. Server-side Rate Limiting (5 attempts max per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`signup:${clientIp}`, 5);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    const body = await request.json();
    const result = signupSchema.safeParse(body);

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

    const { fullName, phoneNumber, password, tier, otpCode } = result.data;

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

    // 3. Check if phone number already exists
    const existingMember = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "A member with this phone number is already registered." },
        {
          status: 409,
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
      // Deliberate fail-closed policy for password creation
      return NextResponse.json(
        { error: hibpResult.error },
        {
          status: 503,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 5. Hash normalized password securely using Argon2id
    const passwordHash = await hashPassword(password);

    // 6. Create new member record storing only the Argon2id hash
    const newMember = await prisma.member.create({
      data: {
        fullName,
        phoneNumber,
        passwordHash,
        tier,
      },
    });

    // 7. Create response with server session cookie (never exposing password or hash)
    const response = NextResponse.json(
      {
        success: true,
        member: {
          id: newMember.id,
          fullName: newMember.fullName,
          phoneNumber: newMember.phoneNumber,
          tier: newMember.tier,
          balanceKobo: newMember.balanceKobo,
          createdAt: newMember.createdAt.toISOString(),
        },
      },
      {
        status: 201,
        headers: getRateLimitHeaders(rateLimit),
      }
    );

    // Set server-side HTTP-only session cookie
    response.cookies.set("spotter_session", newMember.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error) {
    // Handle Prisma unique constraint violation cleanly
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A member with this phone number is already registered." },
        { status: 409 }
      );
    }

    logger.error(
      "Failed to process signup request",
      {
        operation: "signup",
      },
      error
    );

    return NextResponse.json(
      { error: "An unexpected error occurred during sign up. Please try again." },
      { status: 500 }
    );
  }
}
