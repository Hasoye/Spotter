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

    // Look up member by phone number
    const member = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    // Check account status/deactivation before verifying password
    if (member && member.deactivatedAt) {
      return NextResponse.json(
        { error: "This account has been deactivated. Please contact gym staff." },
        {
          status: 403,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // Generic error for invalid credentials
    if (!member || !member.passwordHash) {
      return NextResponse.json(
        { error: "Invalid phone number or password. Please try again." },
        {
          status: 401,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // Verify password against stored Argon2id hash (normalizes leading/trailing spaces)
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

    // Prepare response with safe public member data (never exposing password or hash)
    const response = NextResponse.json(
      {
        success: true,
        member: {
          id: member.id,
          fullName: member.fullName,
          phoneNumber: member.phoneNumber,
          tier: member.tier,
          balanceKobo: member.balanceKobo,
          expiresAt: member.expiresAt ? member.expiresAt.toISOString() : null,
          createdAt: member.createdAt.toISOString(),
        },
      },
      {
        status: 200,
        headers: getRateLimitHeaders(rateLimit),
      }
    );

    // Set server-side HTTP-only session cookie
    response.cookies.set("spotter_session", member.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
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
