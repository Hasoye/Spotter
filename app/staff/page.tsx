import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE_NAME } from "../../lib/staff-session";
import { requireStaffRole, RECEPTIONIST_ROLES } from "../../lib/rbac";
import StaffDashboardClient from "./staff-dashboard-client";

export const metadata: Metadata = {
  title: "Receptionist Console | SPOTTER",
  description: "Front desk console for SPOTTER gym receptionists and staff operations.",
};

export default async function StaffPage() {
  const cookieStore = cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/secure/desk-access");
  }

  // Authoritative database-backed RBAC validation
  const auth = await requireStaffRole(token, RECEPTIONIST_ROLES);

  if (!auth.authorized) {
    if (auth.reason === "FORBIDDEN") {
      redirect("/secure/desk-access?error=unauthorized_role");
    }
    redirect("/secure/desk-access?error=session_expired");
  }

  const staff = auth.staff;

  return (
    <StaffDashboardClient
      staff={{
        id: staff.id,
        fullName: staff.fullName || "Staff Member",
        role: staff.role,
        email: staff.email,
      }}
    />
  );
}

