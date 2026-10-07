import type { Metadata } from "next";
import { Suspense } from "react";
import AuthClient from "./auth-client";

interface AuthPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export function generateMetadata({ searchParams }: AuthPageProps): Metadata {
  const mode = searchParams?.mode === "signup" ? "signup" : "login";

  return mode === "signup"
    ? {
        title: "Sign Up",
        description:
          "Create your Spotter gym account. Enter your details, choose a tier, and verify with an SMS code.",
      }
    : {
        title: "Log In",
        description:
          "Log in to your Spotter gym account with your registered phone number and SMS verification code.",
      };
}

export default function AuthPage({ searchParams }: AuthPageProps) {
  const mode = searchParams?.mode === "signup" ? "signup" : "login";

  return (
    <Suspense fallback={null}>
      <AuthClient initialMode={mode} />
    </Suspense>
  );
}
