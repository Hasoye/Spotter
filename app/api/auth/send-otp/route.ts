import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../../lib/logger";
import { sendOtpSchema } from "../../../../lib/validations";

export async function POST(request: Request) {
  let requestMode: string | undefined;
  try {
    const body = await request.json();
    const result = sendOtpSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message || "Invalid phone number" },
        { status: 400 }
      );
    }

    const { phoneNumber, mode } = result.data;
    requestMode = mode;

    // Check if phone number is already registered
    const existing = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    if (mode === "signup" && existing) {
      return NextResponse.json(
        { error: "This phone number is already registered. Please log in instead." },
        { status: 409 }
      );
    }

    if (mode === "login" && !existing) {
      return NextResponse.json(
        { error: "No account found with this phone number. Please sign up first." },
        { status: 404 }
      );
    }

    // In production, integration with SMS provider sends OTP.
    // For local dev/testing, return success with demo code notification hint.
    return NextResponse.json(
      {
        success: true,
        message: "Verification code sent via SMS",
        devHint: "Demo OTP code is 123456",
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      "Failed to process send-otp request",
      {
        operation: "sendOtp",
        mode: requestMode,
      },
      error
    );

    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}

