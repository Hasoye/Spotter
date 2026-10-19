import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true, completed: true });

  // Persist onboarding completion status for 1 year
  response.cookies.set("spotter_onboarded", "true", {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/spotter_onboarded=([^;]+)/);
  const isOnboarded = match ? decodeURIComponent(match[1]) === "true" : false;

  return NextResponse.json({ onboarded: isOnboarded });
}
