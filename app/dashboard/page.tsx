import type { Metadata } from "next";
import { headers } from "next/headers";
import ClientMemberPortal from "./dashboard-client";
import "../home.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your Spotter gym dashboard — view attendance, balance, ask questions, check in by QR, and manage payments.",
};

export default function DashboardPage() {
  const headerList = headers();
  const id = headerList.get("x-member-id");
  const name = headerList.get("x-member-name");
  const tier = headerList.get("x-member-tier") as "BASIC" | "PREMIUM" | null;

  return (
    <ClientMemberPortal
      initialMember={
        id
          ? {
              id,
              name: name || "Member",
              tier: tier || "BASIC",
            }
          : undefined
      }
    />
  );
}
