"use client";

import React, { useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";

type MemberTier = "BASIC" | "PREMIUM";

interface MemberState {
  id: string;
  name: string;
  tier: MemberTier;
  isExpired: boolean;
  attendanceCount: number;
  balanceKobo: number;
  expiresAt: string;
  lastConfirmedAt: string;
}

interface QueryResult {
  question: string;
  answer: string;
  lastConfirmedAt?: string;
  isStaffRouted: boolean;
  staffNameOnDuty?: string;
  recordId?: string;
  flagged?: boolean;
}

const STAFF_ROUTED_KEYWORDS = [
  "refund",
  "billing dispute",
  "dispute",
  "injury",
  "medical",
  "freeze exception",
  "cancel exception",
  "turnstile",
  "card fault",
  "gate fault",
];

export default function ClientMemberPortal() {
  // Mock logged-in session data per PRD specs
  const [member] = useState<MemberState>({
    id: "mem_101",
    name: "Member Portal",
    tier: "PREMIUM",
    isExpired: false,
    attendanceCount: 14,
    balanceKobo: 0,
    expiresAt: "2026-11-30T00:00:00.000Z",
    lastConfirmedAt: "2026-10-05T18:00:00.000Z",
  });

  const [staffOnDuty] = useState("Alex (Front Desk Staff)");
  const [questionText, setQuestionText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [currentResult, setCurrentResult] = useState<QueryResult | null>(null);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    setIsSearching(true);
    setCurrentResult(null);

    setTimeout(() => {
      const qLower = questionText.toLowerCase();

      // Step 1: Staff routing check
      const isStaffMatch = STAFF_ROUTED_KEYWORDS.some((kw) =>
        qLower.includes(kw)
      );

      if (isStaffMatch) {
        setCurrentResult({
          question: questionText,
          answer: `This question falls into a category requiring staff assistance. Please speak directly with ${staffOnDuty} at the front desk.`,
          isStaffRouted: true,
          staffNameOnDuty: staffOnDuty,
        });
        setIsSearching(false);
        return;
      }

      // Step 2: Private record lookups
      if (qLower.includes("attendance") || qLower.includes("visits") || qLower.includes("check in count")) {
        setCurrentResult({
          question: questionText,
          answer: `You have logged ${member.attendanceCount} check-ins during your current membership period.`,
          lastConfirmedAt: member.lastConfirmedAt,
          isStaffRouted: false,
          recordId: "att_rec_101",
        });
      } else if (qLower.includes("balance") || qLower.includes("due") || qLower.includes("pay")) {
        const balanceFormatted = (member.balanceKobo / 100).toLocaleString("en-NG", {
          style: "currency",
          currency: "NGN",
        });
        setCurrentResult({
          question: questionText,
          answer: `Your current balance is ${balanceFormatted}.`,
          lastConfirmedAt: member.lastConfirmedAt,
          isStaffRouted: false,
          recordId: "bal_rec_101",
        });
      } else if (qLower.includes("expiry") || qLower.includes("expires") || qLower.includes("renew date")) {
        const dateFormatted = new Date(member.expiresAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        setCurrentResult({
          question: questionText,
          answer: `Your membership is active through ${dateFormatted}.`,
          lastConfirmedAt: member.lastConfirmedAt,
          isStaffRouted: false,
          recordId: "exp_rec_101",
        });
      } else if (qLower.includes("tier") || qLower.includes("plan")) {
        setCurrentResult({
          question: questionText,
          answer: `You are currently on the ${member.tier} tier.`,
          lastConfirmedAt: member.lastConfirmedAt,
          isStaffRouted: false,
          recordId: "tier_rec_101",
        });
      } else if (member.isExpired) {
        // Expired members lose access to shared cards per PRD Section 6.18
        setCurrentResult({
          question: questionText,
          answer: `Your membership has expired. Shared records search is restricted until renewal. Please renew your membership to regain full access, or speak with ${staffOnDuty}.`,
          isStaffRouted: true,
          staffNameOnDuty: staffOnDuty,
        });
      } else {
        // Shared-record answer fallback match
        setCurrentResult({
          question: questionText,
          answer: `Gym Access Hours: Monday - Saturday: 6:00 AM - 10:00 PM. Sunday: 8:00 AM - 6:00 PM. Guest Policy: Premium members may bring one guest per weekend session.`,
          lastConfirmedAt: "2026-10-01T12:00:00.000Z",
          isStaffRouted: false,
          recordId: "card_rule_01",
        });
      }

      setIsSearching(false);
    }, 400);
  };

  const handleFlagWrongAnswer = () => {
    if (!currentResult) return;
    setCurrentResult((prev) => (prev ? { ...prev, flagged: true } : null));
  };

  const handleQrScan = () => {
    setQrScanning(true);
    setQrMessage(null);
    setTimeout(() => {
      setQrScanning(false);
      setQrMessage(`QR Scan Successful! Check-in logged at Front Desk Scanner.`);
    }, 1200);
  };

  const handlePayRenew = () => {
    setIsPaying(true);
    setPaymentStatus(null);
    setTimeout(() => {
      setIsPaying(false);
      setPaymentStatus(`Payment initiated via Flutterwave. Server webhook confirmation is pending.`);
    }, 1000);
  };

  const formattedExpiry = new Date(member.expiresAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedConfirmed = new Date(member.lastConfirmedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="homeContainer">
      <header className="homeHeader">
        <div className="brandBar">
          <h1 className="brandDisplay">SPOTTER</h1>
          <span
            className={`tierBadge ${
              member.tier === "PREMIUM" ? "tierBadgePremium" : "tierBadgeBasic"
            }`}
          >
            {member.tier} TIER
          </span>
        </div>
        <h2 className="homeHeadline">Gym Member Portal</h2>
        <p className="homeSubtitle">
          Retrieval-only access for member records, QR check-in, and payments.
        </p>
      </header>

      {member.isExpired && (
        <div className="expiredAlert" role="alert">
          Your membership has expired. You retain access to your balance and payment options. Renew now to restore shared records and training plans.
        </div>
      )}

      {/* Member Statistics Grid */}
      <section className="memberGrid" aria-label="Member Overview">
        <div className="statCard">
          <span className="statLabel">Attendance</span>
          <span className="statValue">{member.attendanceCount} visits</span>
          <span className="statTimestamp">
            Confirmed at {formattedConfirmed}
          </span>
        </div>

        <div className="statCard">
          <span className="statLabel">Balance Owed</span>
          <span className="statValue">
            {(member.balanceKobo / 100).toLocaleString("en-NG", {
              style: "currency",
              currency: "NGN",
            })}
          </span>
          <span className="statTimestamp">
            Confirmed at {formattedConfirmed}
          </span>
        </div>

        <div className="statCard">
          <span className="statLabel">Membership Expiry</span>
          <span className="statValue">{formattedExpiry}</span>
          <span className="statTimestamp">
            Confirmed at {formattedConfirmed}
          </span>
        </div>
      </section>

      {/* Ask Spotter Q&A Interface */}
      <section className="askSection" aria-label="Ask Spotter">
        <h3 className="sectionTitle">Ask Spotter</h3>
        <form onSubmit={handleSearch} className="askForm">
          <div className="askFormRow">
            <Input
              id="memberQuery"
              label="Question"
              hint="e.g. 'What is my attendance count?' or 'What are the gym access hours?'"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Ask a question about gym rules, balance, or hours..."
            />
            <Button type="submit" isLoading={isSearching}>
              Search
            </Button>
          </div>
        </form>

        {currentResult && (
          <div className="answerBox" role="region" aria-live="polite">
            <div className="answerHeader">
              <span className="answerMeta">
                {currentResult.isStaffRouted ? "Staff Handoff" : "Record Answer"}
              </span>
              {currentResult.lastConfirmedAt && (
                <span className="answerMeta">
                  Record confirmed:{" "}
                  {new Date(currentResult.lastConfirmedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="answerText">{currentResult.answer}</p>
            <div className="answerFooter">
              {currentResult.flagged ? (
                <span className="flagSuccess">
                  ✓ Flagged for Owner review
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleFlagWrongAnswer}
                  className="flagButton"
                >
                  This doesn't look right
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Quick Action Grid */}
      <section className="actionsGrid" aria-label="Quick Actions">
        {/* QR Check-in */}
        <div className="actionCard">
          <h3 className="sectionTitle">QR Code Check-In</h3>
          <p className="actionCardText">
            Scan the front desk QR code to log your attendance.
          </p>
          <Button onClick={handleQrScan} isLoading={qrScanning} variant="primary">
            Scan Gym QR Code
          </Button>
          {qrMessage && (
            <div className="staffBanner" role="status">
              {qrMessage}
            </div>
          )}
          <div className="staffBanner">
            If scan fails, ask <strong>{staffOnDuty}</strong> at the front desk to log a manual check-in.
          </div>
        </div>

        {/* Payments & Renewal */}
        <div className="actionCard">
          <h3 className="sectionTitle">Payment & Renewal</h3>
          <p className="actionCardText">
            Renew membership or pay outstanding balances securely.
          </p>
          <Button onClick={handlePayRenew} isLoading={isPaying} variant="secondary">
            Pay / Renew via Gateway
          </Button>
          {paymentStatus && (
            <div className="staffBanner" role="status">
              {paymentStatus}
            </div>
          )}
        </div>

        {/* Training Plan (Premium Tier Only) */}
        <div className="actionCard">
          <h3 className="sectionTitle">Written Training Plan</h3>
          {member.tier === "PREMIUM" && !member.isExpired ? (
            <div className="staffBanner">
              <strong>Active Plan:</strong> Hypertrophy & Strength 4x/week (Upper/Lower Split). Updated by gym trainer.
            </div>
          ) : (
            <p className="actionCardText">
              Training plans are available exclusively on the Premium tier. Upgrade or renew to view your plan.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
