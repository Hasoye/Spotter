import type { Metadata } from "next";
import SignupClient from "./signup-client";

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    "Create your Spotter gym account. Enter your details, choose a tier, and verify with an SMS code.",
};

export default function SignupPage() {
  return <SignupClient />;
}
