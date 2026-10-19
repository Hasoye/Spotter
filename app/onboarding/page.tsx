import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";

export const metadata: Metadata = {
  title: "Welcome to SPOTTER | Member Onboarding",
  description:
    "Quickly learn how to navigate your SPOTTER member experience, membership status, and dashboard.",
};

export default function OnboardingPage() {
  const cookieStore = cookies();
  const isOnboarded = cookieStore.get("spotter_onboarded")?.value === "true";

  // If already completed or skipped onboarding, direct straight to dashboard
  if (isOnboarded) {
    redirect("/dashboard");
  }

  const headerList = headers();
  const memberName = headerList.get("x-member-name") || "Member";
  const memberTier = headerList.get("x-member-tier") || "BASIC";

  return (
    <OnboardingClient
      initialMemberName={memberName}
      initialMemberTier={memberTier}
    />
  );
}
