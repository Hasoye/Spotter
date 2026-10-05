import type { Metadata } from "next";
import LoginClient from "./login-client";

export const metadata: Metadata = {
  title: "Log In",
  description:
    "Log in to your Spotter gym account with your registered phone number and SMS verification code.",
};

export default function LoginPage() {
  return <LoginClient />;
}
