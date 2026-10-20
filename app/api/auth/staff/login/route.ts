import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { logger } from "../../../../../lib/logger";
import { staffLoginSchema } from "../../../../../lib/validations";
import { verifyPassword } from "../../../../../lib/password";
import {
  getClientIp,
  checkRateLimit,
  getRateLimitHeaders,
} from "../../../../../lib/rate-limit";
import {
  issueStaffSession,
  STAFF_COOKIE_NAME,
} from "../../../../../lib/staff-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Server-side Rate Limiting (5 attempts max per IP)
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`staff-login:${clientIp}`, 5);

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
    const result = staffLoginSchema.safeParse(body);

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

    const { identifier, password } = result.data;
    const trimmedId = identifier.trim();
    const lowerId = trimmedId.toLowerCase();
    const cleanedPhone = trimmedId.replace(/[\s-]/g, "");

    // 2. Look up staff record by email or phone number
    const staff = await prisma.staff.findFirst({
      where: {
        OR: [
          { email: { equals: lowerId, mode: "insensitive" } },
          { phoneNumber: trimmedId },
          { phoneNumber: cleanedPhone },
        ],
      },
    });

    // 3. Constant-time-like generic rejection if staff not found or has no password hash
    if (!staff || !staff.passwordHash) {
      return NextResponse.json(
        { error: "Invalid staff credentials. Please check your details and try again." },
        {
          status: 401,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 4. Verify password against stored Argon2id hash
    const isPasswordValid = await verifyPassword(staff.passwordHash, password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid staff credentials. Please check your details and try again." },
        {
          status: 401,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 5. Verify staff account is active
    if (!staff.isActive) {
      return NextResponse.json(
        { error: "Staff account is deactivated. Please contact the administrator." },
        {
          status: 403,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 6. Verify role permissions (only FRONT_DESK and OWNER allowed)
    if (staff.role !== "FRONT_DESK" && staff.role !== "OWNER") {
      return NextResponse.json(
        { error: "Access denied. Your role is not authorized for front desk operations." },
        {
          status: 403,
          headers: getRateLimitHeaders(rateLimit),
        }
      );
    }

    // 7. Issue fresh staff session (stores only SHA-256 hash in DB)
    const userAgent = request.headers.get("user-agent") || undefined;
    const session = await issueStaffSession(staff.id, {
      ipAddress: clientIp,
      userAgent,
    });

    // 8. Return response with dedicated HTTP-only staff session cookie
    const response = NextResponse.json(
      {
        success: true,
        staff: {
          id: staff.id,
          fullName: staff.fullName,
          email: staff.email,
          role: staff.role,
        },
      },
      {
        status: 200,
        headers: getRateLimitHeaders(rateLimit),
      }
    );

    response.cookies.set(STAFF_COOKIE_NAME, session.rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });

    return response;
  } catch (error) {
    logger.error(
      "Failed to process staff login request",
      {
        operation: "staffLogin",
      },
      error
    );

    return NextResponse.json(
      { error: "An unexpected error occurred during staff login. Please try again." },
      { status: 500 }
    );
  }
}
