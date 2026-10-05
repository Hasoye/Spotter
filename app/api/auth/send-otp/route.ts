import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";

const sendOtpSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[0-9\s-]+$/, "Invalid phone number format"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = sendOtpSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message || "Invalid phone number" },
        { status: 400 }
      );
    }

    const { phoneNumber } = result.data;

    // Check if phone number is already registered
    const existing = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This phone number is already registered. Please log in instead." },
        { status: 409 }
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
    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
