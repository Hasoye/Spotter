import type { Metadata } from "next";
import { Suspense } from "react";
import "./desk-access.css";
import DeskAccessClient from "./desk-access-client";

export const metadata: Metadata = {
  title: "Staff Desk Access | SPOTTER",
  description: "Secure front desk authentication for SPOTTER staff.",
};

export default function DeskAccessPage() {
  return (
    <Suspense fallback={null}>
      <DeskAccessClient />
    </Suspense>
  );
}

