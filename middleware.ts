import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/member",
  "/settings",
  "/profile",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  const isAuthPage =
    pathname === "/auth" || pathname === "/login" || pathname === "/signup";

  const sessionCookie = request.cookies.get("spotter_session")?.value;

  // 1. If trying to access a protected page without a session cookie, ask user to log in
  if (isProtected && !sessionCookie) {
    const loginUrl = new URL("/auth?mode=login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If a session cookie is present, verify it against the database via server verification endpoint
  if (sessionCookie) {
    try {
      const verifyUrl = new URL("/api/auth/verify-session", request.url);
      const verifyRes = await fetch(verifyUrl, {
        headers: {
          cookie: `spotter_session=${encodeURIComponent(sessionCookie)}`,
        },
      });

      if (verifyRes.ok) {
        const data = await verifyRes.json();
        if (data.valid && data.member) {
          // If already authenticated and visiting login/signup, redirect to dashboard
          if (isAuthPage) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }

          // Attach user to the request headers so browser pages know who is logged in
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set("x-member-id", data.member.id);
          requestHeaders.set("x-member-phone", data.member.phoneNumber);
          requestHeaders.set("x-member-name", data.member.fullName);
          requestHeaders.set("x-member-tier", data.member.tier);

          return NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
        }
      }

      // If session verification failed (expired, revoked, user locked or banned)
      if (isProtected) {
        const loginUrl = new URL("/auth?mode=login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        loginUrl.searchParams.set("error", "session_expired");

        const response = NextResponse.redirect(loginUrl);
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
    } catch {
      // In case of verification network failure on protected page, ask user to log in
      if (isProtected) {
        return NextResponse.redirect(new URL("/auth?mode=login", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/auth (auth API routes like login, signup, send-otp, logout, verify-session)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - static image/asset extensions
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
