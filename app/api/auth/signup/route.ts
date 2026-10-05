import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";

const signupSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters long")
    .max(100, "Full name is too long"),
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[0-9\s-]+$/, "Invalid phone number format"),
  tier: z.enum(["BASIC", "PREMIUM"]).default("BASIC"),
  otpCode: z.string().length(6, "Verification code must be exactly 6 digits"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.errors[0]?.message || "Invalid input data";
      return NextResponse.json(
        { error: firstError, details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { fullName, phoneNumber, tier, otpCode } = result.data;

    // Simulated SMS OTP check (for MVP development workflow)
    if (otpCode !== "123456" && otpCode !== "000000") {
      return NextResponse.json(
        { error: "Invalid verification code. Please check your SMS and try again." },
        { status: 400 }
      );
    }

    // Check if phone number already exists
    const existingMember = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "A member with this phone number is already registered." },
        { status: 409 }
      );
    }

    // Create new member record
    const newMember = await prisma.member.create({
      data: {
        fullName,
        phoneNumber,
        tier,
      },
    });

    // Create response with server session cookie
    const response = NextResponse.json(
      {
        success: true,
        member: {
          id: newMember.id,
          fullName: newMember.fullName,
          phoneNumber: newMember.phoneNumber,
          tier: newMember.tier,
        },
      },
      { status: 201 }
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
    return NextResponse.json(
      { error: "An unexpected error occurred during sign up. Please try again." },
      { status: 500 }
    );
  }
}
