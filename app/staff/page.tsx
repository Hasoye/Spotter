import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getValidStaffSession,
  STAFF_COOKIE_NAME,
} from "../../lib/staff-session";
import StaffDashboardClient from "./staff-dashboard-client";

export const metadata: Metadata = {
  title: "Receptionist Console | SPOTTER",
  description: "Front desk console for SPOTTER gym receptionists and staff operations.",
};

export default async function StaffPage() {
  const headerList = headers();
  let staffId = headerList.get("x-staff-id");
  let staffName = headerList.get("x-staff-name");
  let staffRole = headerList.get("x-staff-role");
  let staffEmail = headerList.get("x-staff-email");

  // Fallback: If middleware didn't populate headers (e.g. direct server render), verify from cookie
  if (!staffId) {
    const cookieStore = cookies();
    const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
    if (!token) {
      redirect("/secure/desk-access");
    }

    const session = await getValidStaffSession(token);
    if (!session || !session.staff) {
      redirect("/secure/desk-access?error=session_expired");
    }

    if (session.staff.role !== "FRONT_DESK" && session.staff.role !== "OWNER") {
      redirect("/secure/desk-access?error=unauthorized_role");
    }

    staffId = session.staff.id;
    staffName = session.staff.fullName;
    staffRole = session.staff.role;
    staffEmail = session.staff.email;
  }

  // Double check authorization server-side
  if (staffRole !== "FRONT_DESK" && staffRole !== "OWNER") {
    redirect("/secure/desk-access?error=unauthorized_role");
  }

  return (
    <StaffDashboardClient
      staff={{
        id: staffId,
        fullName: staffName || "Staff Member",
        role: staffRole,
        email: staffEmail,
      }}
    />
  );
}
