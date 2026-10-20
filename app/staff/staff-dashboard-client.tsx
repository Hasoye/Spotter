"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import "./staff.css";

interface GeneratedMemberRecord {
  id: string;
  fullName: string;
  phoneNumber: string;
  memberNumber: string;
  tier: "BASIC" | "PREMIUM";
  timestamp: string;
  action: string;
}

interface StaffDashboardClientProps {
  staff: {
    id: string;
    fullName: string;
    role: string;
    email?: string | null;
  };
}

export default function StaffDashboardClient({ staff }: StaffDashboardClientProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Intending Member Form State
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [tier, setTier] = useState<"BASIC" | "PREMIUM">("BASIC");
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; phoneNumber?: string }>({});
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Latest Generated Result State
  const [latestGenerated, setLatestGenerated] = useState<GeneratedMemberRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState<GeneratedMemberRecord[]>([]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/staff/logout", {
        method: "POST",
      });
      router.push("/secure/desk-access");
      router.refresh();
    } catch {
      setIsLoggingOut(false);
      router.push("/secure/desk-access");
    }
  };

  const validateForm = () => {
    const errors: { fullName?: string; phoneNumber?: string } = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = "Please enter the intending member's full name (at least 2 characters).";
    }
    const cleanedPhone = phoneNumber.trim().replace(/[\s-]/g, "");
    if (!cleanedPhone || cleanedPhone.length < 10) {
      errors.phoneNumber = "Please enter a valid phone number (at least 10 digits).";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGenerateMemberNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerationError(null);
    setCopied(false);

    if (!validateForm()) return;

    setIsGenerating(true);

    try {
      const res = await fetch("/api/staff/generate-member-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phoneNumber, tier }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGenerationError(data.error || "Failed to generate member number.");
        setIsGenerating(false);
        return;
      }

      const record: GeneratedMemberRecord = {
        id: data.member.id,
        fullName: data.member.fullName,
        phoneNumber: data.member.phoneNumber,
        memberNumber: data.member.memberNumber,
        tier: data.member.tier,
        timestamp: data.member.allocatedAt || data.member.createdAt || new Date().toISOString(),
        action: data.action || "GENERATED",
      };

      setLatestGenerated(record);
      setRecentGenerations((prev) => [record, ...prev]);

      // Reset form fields for next entry
      setFullName("");
      setPhoneNumber("");
      setTier("BASIC");
      setIsGenerating(false);
    } catch {
      setGenerationError("Network error. Could not connect to member allocation service.");
      setIsGenerating(false);
    }
  };

  const handleCopyNumber = () => {
    if (!latestGenerated) return;
    navigator.clipboard.writeText(latestGenerated.memberNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="staffLayout">
      <header className="staffHeader">
        <div className="staffHeaderBrand">
          <span className="staffLogoBadge">SPOTTER</span>
          <h1 className="staffHeaderTitle">Receptionist Console</h1>
        </div>
        <div className="staffUserBadge">
          <span className="staffRolePill">{staff.role}</span>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>{staff.fullName}</span>
          <Button
            variant="secondary"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            style={{ fontSize: "12px", padding: "6px 14px", height: "auto" }}
          >
            Log Out
          </Button>
        </div>
      </header>

      <main className="staffDashboardContent">
        {/* Reception Desk Header Card */}
        <div className="staffDashboardCard">
          <div className="staffDashboardCardHeader">
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px 0" }}>
                Front Desk Member Onboarding
              </h2>
              <p style={{ fontSize: "14px", color: "var(--color-roles-on-surface-variant)", margin: 0 }}>
                Logged in as <strong>{staff.fullName}</strong> ({staff.role}) • Authorized Front Desk Shift
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "var(--color-roles-primary)",
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "var(--color-roles-primary)",
                    display: "inline-block",
                  }}
                />
                Desk Active
              </span>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <p style={{ fontSize: "14px", color: "var(--color-roles-on-surface)", lineHeight: "1.5" }}>
              Use this secure terminal to generate and allocate an authentic Spotter member number for an intending gym member. The member number is generated server-side with guaranteed uniqueness.
            </p>
          </div>
        </div>

        {/* Member Number Generator & Allocation Section */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: latestGenerated ? "1fr 1fr" : "1fr",
            gap: "24px",
            alignItems: "start",
          }}
        >
          {/* Intake Form */}
          <div className="staffDashboardCard">
            <h3 style={{ fontSize: "17px", fontWeight: 600, margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📝</span> Intending Member Details
            </h3>

            {generationError && (
              <div
                className="staffAlert staffAlertError"
                role="alert"
                style={{ marginBottom: "16px" }}
              >
                <p style={{ margin: 0, fontSize: "13px" }}>{generationError}</p>
              </div>
            )}

            <form onSubmit={handleGenerateMemberNumber} className="staffForm" noValidate>
              <Input
                id="intending-fullName"
                label="Full Name"
                placeholder="e.g. Babatunde Fashola"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                }}
                error={fieldErrors.fullName}
                disabled={isGenerating}
              />

              <Input
                id="intending-phoneNumber"
                label="Phone Number"
                placeholder="e.g. 08012345678 or +2348012345678"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  if (fieldErrors.phoneNumber) setFieldErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                }}
                error={fieldErrors.phoneNumber}
                disabled={isGenerating}
              />

              <div className="fieldGroup">
                <label htmlFor="intending-tier" className="fieldLabel">
                  Intended Membership Tier
                </label>
                <select
                  id="intending-tier"
                  className="fieldInput"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as "BASIC" | "PREMIUM")}
                  disabled={isGenerating}
                  style={{
                    backgroundColor: "var(--color-roles-surface-container)",
                    color: "var(--color-roles-on-surface)",
                  }}
                >
                  <option value="BASIC">BASIC (Timetable, prices, attendance & balance)</option>
                  <option value="PREMIUM">PREMIUM (All Basic features + Written training plan)</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isGenerating}
                style={{ marginTop: "8px", width: "100%" }}
              >
                Generate & Allocate Member Number
              </Button>
            </form>
          </div>

          {/* Allocation Result Card */}
          {latestGenerated && (
            <div
              className="staffDashboardCard"
              style={{
                border: "2px solid var(--color-roles-primary)",
                backgroundColor: "var(--color-roles-surface-container-high)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span
                  style={{
                    backgroundColor: "var(--color-roles-primary-container)",
                    color: "var(--color-roles-on-primary-container)",
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "3px 8px",
                    borderRadius: "4px",
                  }}
                >
                  Number Allocated
                </span>
                <span style={{ fontSize: "12px", color: "var(--color-roles-on-surface-variant)" }}>
                  {new Date(latestGenerated.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--color-roles-on-surface-variant)" }}>
                  Official Member Number
                </span>
                <div
                  style={{
                    fontSize: "30px",
                    fontWeight: 800,
                    letterSpacing: "2px",
                    color: "var(--color-roles-primary)",
                    margin: "8px 0",
                    fontFamily: "monospace",
                  }}
                >
                  {latestGenerated.memberNumber}
                </div>
                <Button
                  variant="secondary"
                  onClick={handleCopyNumber}
                  style={{ fontSize: "12px", padding: "6px 16px", height: "auto" }}
                >
                  {copied ? "✓ Copied to Clipboard" : "Copy Member Number"}
                </Button>
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--color-roles-outline-variant)",
                  paddingTop: "14px",
                  fontSize: "13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div>
                  <span style={{ color: "var(--color-roles-on-surface-variant)" }}>Member Name: </span>
                  <strong>{latestGenerated.fullName}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--color-roles-on-surface-variant)" }}>Phone: </span>
                  <strong>{latestGenerated.phoneNumber}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--color-roles-on-surface-variant)" }}>Tier: </span>
                  <strong>{latestGenerated.tier}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--color-roles-on-surface-variant)" }}>Confirmed: </span>
                  <strong>{new Date(latestGenerated.timestamp).toLocaleString()}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Shifts Generations Table */}
        {recentGenerations.length > 0 && (
          <div className="staffDashboardCard" style={{ marginTop: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 14px 0" }}>
              Allocations in Current Shift ({recentGenerations.length})
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-roles-outline-variant)", color: "var(--color-roles-on-surface-variant)" }}>
                    <th style={{ padding: "8px 10px" }}>Member Number</th>
                    <th style={{ padding: "8px 10px" }}>Full Name</th>
                    <th style={{ padding: "8px 10px" }}>Phone</th>
                    <th style={{ padding: "8px 10px" }}>Tier</th>
                    <th style={{ padding: "8px 10px" }}>Allocated At</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGenerations.map((rec) => (
                    <tr key={rec.id} style={{ borderBottom: "1px solid var(--color-roles-outline-variant)" }}>
                      <td style={{ padding: "10px", fontWeight: 700, fontFamily: "monospace", color: "var(--color-roles-primary)" }}>
                        {rec.memberNumber}
                      </td>
                      <td style={{ padding: "10px" }}>{rec.fullName}</td>
                      <td style={{ padding: "10px" }}>{rec.phoneNumber}</td>
                      <td style={{ padding: "10px" }}>
                        <span className="staffRolePill" style={{ fontSize: "10px" }}>
                          {rec.tier}
                        </span>
                      </td>
                      <td style={{ padding: "10px", color: "var(--color-roles-on-surface-variant)" }}>
                        {new Date(rec.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
