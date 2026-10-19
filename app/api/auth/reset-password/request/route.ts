import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { logger } from "../../../../../lib/logger";
import { requestResetSchema } from "../../../../../lib/validations";
import {
  getClientIp,
  checkRateLimit,
  getRateLimitHeaders,
} from "../../../../../lib/rate-limit";

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
    const result = requestResetSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.errors[0]?.message || "Invalid phone number";
      return NextResponse.json(
        { error: firstError },
        {
          status: 400,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    const { phoneNumber } = result.data;

    // 2. Account-enumeration protection:
    // Safely check if member exists without revealing whether the phone number is registered.
    const member = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    // In production, if member exists and is not deactivated, SMS provider sends OTP.
    // Whether member exists or not, we return the exact same generic confirmation message.
    return NextResponse.json(
      {
        success: true,
        message: "If an account exists for this number, you will receive a verification code.",
        devHint: "Demo OTP code is 123456",
      },
      {
        status: 200,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  } catch (error) {
    logger.error(
      "Failed to process password reset request",
      {
        operation: "resetPasswordRequest",
      },
      error
    );

    return NextResponse.json(
      { error: "Failed to process request. Please try again." },
      { status: 500 }
    );
  }
}
