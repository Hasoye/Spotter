import { NextResponse } from "next/server";
import { revokeMemberSession } from "../../../../lib/session";
import { logger } from "../../../../lib/logger";

function createLoggedOutResponse(redirectUrl?: string) {
  const response = redirectUrl
    ? NextResponse.redirect(redirectUrl)
    : NextResponse.json(
        { success: true, message: "Logged out successfully" },
        { status: 200 }
      );

  // Clear HTTP-only session cookie server-side
  response.cookies.set("spotter_session", "", {
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
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/spotter_session=([^;]+)/);
    const sessionToken = match ? decodeURIComponent(match[1]) : null;

    if (sessionToken) {
      await revokeMemberSession(sessionToken);
    }

    return createLoggedOutResponse();
  } catch (error) {
    logger.error(
      "Failed to process server-side logout",
      { operation: "logout" },
      error
    );
    // Still clear the cookie on error to protect the user
    return createLoggedOutResponse();
  }
}

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/spotter_session=([^;]+)/);
    const sessionToken = match ? decodeURIComponent(match[1]) : null;

    if (sessionToken) {
      await revokeMemberSession(sessionToken);
    }

    const url = new URL("/auth?mode=login", request.url);
    return createLoggedOutResponse(url.toString());
  } catch {
    const url = new URL("/auth?mode=login", request.url);
    return createLoggedOutResponse(url.toString());
  }
}
