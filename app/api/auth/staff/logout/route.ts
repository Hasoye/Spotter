import { NextResponse } from "next/server";
import {
  revokeStaffSession,
  STAFF_COOKIE_NAME,
} from "../../../../../lib/staff-session";
import { logger } from "../../../../../lib/logger";

export const dynamic = "force-dynamic";

function createLoggedOutStaffResponse(redirectUrl?: string) {
  const response = redirectUrl
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.json({
        success: true,
        message: "Staff logged out successfully.",
      });

  // Clear HTTP-only staff session cookie
  response.cookies.set(STAFF_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}

export async function POST(request: Request) {
  try {
    const cookieHeader = request?.headers?.get("cookie") || "";
    const regex = new RegExp(`${STAFF_COOKIE_NAME}=([^;]+)`);
    const match = cookieHeader.match(regex);
    const rawToken = match ? decodeURIComponent(match[1]) : null;

    if (rawToken) {
      await revokeStaffSession(rawToken);
    }

    return createLoggedOutStaffResponse();
  } catch (error) {
    logger.error(
      "Failed to process staff logout request",
      { operation: "staffLogout" },
      error
    );

    // Still clear cookie on error to protect staff session security
    return createLoggedOutStaffResponse();
  }
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const regex = new RegExp(`${STAFF_COOKIE_NAME}=([^;]+)`);
    const match = cookieHeader.match(regex);
    const rawToken = match ? decodeURIComponent(match[1]) : null;

    if (rawToken) {
      await revokeStaffSession(rawToken);
    }

    const url = new URL("/secure/desk-access", request.url);
    return createLoggedOutStaffResponse(url.toString());
  } catch {
    const url = new URL("/secure/desk-access", request.url);
    return createLoggedOutStaffResponse(url.toString());
  }
}
