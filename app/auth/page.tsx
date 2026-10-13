import type { Metadata } from "next";
import { Suspense } from "react";
import AuthClient from "./auth-client";

interface AuthPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export function generateMetadata({ searchParams }: AuthPageProps): Metadata {
  const mode =
    searchParams?.mode === "signup"
      ? "signup"
      : searchParams?.mode === "forgot"
      ? "forgot"
      : "login";

  if (mode === "signup") {
    return {
      title: "Sign Up",
      description:
        "Create your Spotter gym account. Enter your details, choose a tier, and verify with an SMS code.",
    };
  }

  if (mode === "forgot") {
    return {
      title: "Reset Password",
      description:
        "Reset your Spotter gym account password with SMS verification and secure password checks.",
    };
  }

  return {
    title: "Log In",
    description:
      "Log in to your Spotter gym account with your registered phone number and password.",
  };
}

export default function AuthPage({ searchParams }: AuthPageProps) {
  const mode =
    searchParams?.mode === "signup"
      ? "signup"
      : searchParams?.mode === "forgot"
      ? "forgot"
      : "login";

  return (
    <Suspense fallback={null}>
      <AuthClient initialMode={mode} />
    </Suspense>
  );
}
