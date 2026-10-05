import type { Metadata } from "next";
import ClientMemberPortal from "./dashboard-client";
import "../home.css";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Your Spotter gym dashboard — view attendance, balance, ask questions, check in by QR, and manage payments.",
};

export default function DashboardPage() {
  return <ClientMemberPortal />;
}
