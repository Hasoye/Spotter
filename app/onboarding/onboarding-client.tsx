"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import "./onboarding.css";

interface OnboardingClientProps {
  initialMemberName?: string;
  initialMemberTier?: string;
}

export default function OnboardingClient({
  initialMemberName,
  initialMemberTier = "BASIC",
}: OnboardingClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const completeOnboardingAndNavigate = async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    try {
      // Set client cookie immediately for instant client-side state
      if (typeof document !== "undefined") {
        document.cookie =
          "spotter_onboarded=true; path=/; max-age=31536000; SameSite=Lax";
      }

      // Persist onboarding status on server
      await fetch("/api/member/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Fallback proceeds gracefully
    } finally {
      router.push("/dashboard");
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep((prev) => ((prev + 1) as 2 | 3));
        setIsTransitioning(false);
      }, 150);
    } else {
      completeOnboardingAndNavigate();
    }
  };

  const handleSkip = () => {
    completeOnboardingAndNavigate();
  };

  return (
    <div className="onboardingPage">
      <main className="onboardingCard" role="region" aria-label="Product onboarding">
        {/* Progress & Brand Header */}
        <div className="onboardingProgressRow">
          <div className="onboardingBrand">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 4v16M18 4v16M2 9h4M2 15h4M18 9h4M18 15h4M6 12h12" />
            </svg>
            <span>SPOTTER</span>
          </div>

          <div
            className="onboardingDots"
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={3}
            aria-label={`Step ${currentStep} of 3`}
          >
            <div
              className={`onboardingDot ${currentStep === 1 ? "onboardingDotActive" : ""}`}
            />
            <div
              className={`onboardingDot ${currentStep === 2 ? "onboardingDotActive" : ""}`}
            />
            <div
              className={`onboardingDot ${currentStep === 3 ? "onboardingDotActive" : ""}`}
            />
          </div>
        </div>

        {/* Dynamic Step Content */}
        <div
          className={`onboardingSlide ${
            isTransitioning ? "onboardingSlideEntering" : "onboardingSlideVisible"
          }`}
          key={currentStep}
        >
          {/* SCREEN 1: WELCOME */}
          {currentStep === 1 && (
            <>
              <div
                className="onboardingVisualArea"
                aria-label="Welcome illustration"
              >
                <div className="onboardingIllustration">
                  <svg
                    width="180"
                    height="140"
                    viewBox="0 0 180 140"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Glowing background halo */}
                    <circle
                      cx="90"
                      cy="70"
                      r="54"
                      fill="#009973"
                      fillOpacity="0.12"
                    />
                    <circle
                      cx="90"
                      cy="70"
                      r="42"
                      fill="#009973"
                      fillOpacity="0.18"
                    />

                    {/* Member ID Emblem Badge */}
                    <rect
                      x="45"
                      y="26"
                      width="90"
                      height="88"
                      rx="16"
                      fill="#ffffff"
                      stroke="#009973"
                      strokeWidth="2"
                    />

                    {/* Badge header */}
                    <rect
                      x="45"
                      y="26"
                      width="90"
                      height="24"
                      rx="16"
                      fill="#009973"
                    />
                    <rect
                      x="45"
                      y="40"
                      width="90"
                      height="10"
                      fill="#009973"
                    />
                    <circle cx="90" cy="38" r="4" fill="#ffffff" />

                    {/* Member Avatar / Dumbbell Crest */}
                    <circle
                      cx="90"
                      cy="68"
                      r="14"
                      fill="#009973"
                      fillOpacity="0.12"
                    />
                    <path
                      d="M84 68h12M83 65v6M97 65v6"
                      stroke="#009973"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />

                    {/* Verified Pill */}
                    <rect
                      x="60"
                      y="92"
                      width="60"
                      height="14"
                      rx="7"
                      fill="#e7fff1"
                    />
                    <text
                      x="90"
                      y="102"
                      fill="#00513b"
                      fontSize="7.5"
                      fontFamily="DM Sans, sans-serif"
                      fontWeight="700"
                      textAnchor="middle"
                      letterSpacing="0.5"
                    >
                      VERIFIED PASS
                    </text>

                    {/* Floating accents */}
                    <circle cx="34" cy="46" r="3" fill="#00e1a8" />
                    <circle cx="146" cy="94" r="4" fill="#009973" fillOpacity="0.4" />
                    <circle cx="144" cy="42" r="2.5" fill="#00e1a8" />
                  </svg>
                </div>
              </div>

              <div className="onboardingContent">
                <h1 className="onboardingTitle" id="onboarding-heading">
                  Welcome to SPOTTER
                </h1>
                <p className="onboardingBody">
                  Your member account is ready. Here&apos;s a quick look around.
                </p>
              </div>

              <div className="onboardingActions">
                <button
                  type="button"
                  className="onboardingPrimaryBtn"
                  onClick={handleNext}
                  id="onboarding-next-btn"
                  autoFocus
                >
                  Next
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="onboardingSkipBtn"
                  onClick={handleSkip}
                  id="onboarding-skip-btn"
                >
                  Skip
                </button>
              </div>
            </>
          )}

          {/* SCREEN 2: MEMBERSHIP */}
          {currentStep === 2 && (
            <>
              <div
                className="onboardingVisualArea"
                aria-label="Membership overview illustration"
              >
                <div className="onboardingIllustration">
                  <svg
                    width="200"
                    height="140"
                    viewBox="0 0 200 140"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Membership Card Mockup */}
                    <rect
                      x="20"
                      y="20"
                      width="160"
                      height="100"
                      rx="14"
                      fill="#002116"
                      stroke="#009973"
                      strokeWidth="1.5"
                    />

                    {/* Subtle card wave pattern */}
                    <path
                      d="M20 70c30-10 60 20 100 0s30-20 60-10v50c-30-10-60 10-100 0s-30-20-60-10V70z"
                      fill="#003828"
                      fillOpacity="0.5"
                    />

                    {/* Tier badge */}
                    <rect
                      x="34"
                      y="32"
                      width="54"
                      height="16"
                      rx="8"
                      fill="#009973"
                    />
                    <text
                      x="61"
                      y="43"
                      fill="#ffffff"
                      fontSize="8"
                      fontFamily="DM Sans, sans-serif"
                      fontWeight="700"
                      textAnchor="middle"
                      letterSpacing="0.6"
                    >
                      {initialMemberTier} TIER
                    </text>

                    {/* Status Pill */}
                    <circle cx="152" cy="40" r="3.5" fill="#45fec3" />
                    <text
                      x="162"
                      y="43"
                      fill="#bcffe0"
                      fontSize="8.5"
                      fontFamily="DM Sans, sans-serif"
                      fontWeight="600"
                    >
                      Active
                    </text>

                    {/* Member Name */}
                    <text
                      x="34"
                      y="82"
                      fill="#ffffff"
                      fontSize="12"
                      fontFamily="DM Sans, sans-serif"
                      fontWeight="600"
                    >
                      {initialMemberName || "Gym Member"}
                    </text>

                    {/* Attendance and Expiry mini stats */}
                    <rect
                      x="34"
                      y="94"
                      width="60"
                      height="14"
                      rx="4"
                      fill="#00513b"
                    />
                    <text
                      x="64"
                      y="104"
                      fill="#bcffe0"
                      fontSize="7.5"
                      fontFamily="DM Sans, sans-serif"
                      fontWeight="500"
                      textAnchor="middle"
                    >
                      Attendance Tracker
                    </text>

                    <rect
                      x="102"
                      y="94"
                      width="64"
                      height="14"
                      rx="4"
                      fill="#00513b"
                    />
                    <text
                      x="134"
                      y="104"
                      fill="#bcffe0"
                      fontSize="7.5"
                      fontFamily="DM Sans, sans-serif"
                      fontWeight="500"
                      textAnchor="middle"
                    >
                      Plan Renewal
                    </text>
                  </svg>
                </div>
              </div>

              <div className="onboardingContent">
                <h1 className="onboardingTitle" id="onboarding-heading">
                  Your membership, at a glance
                </h1>
                <p className="onboardingBody">
                  Keep your membership status and plan details within easy reach.
                </p>
              </div>

              <div className="onboardingActions">
                <button
                  type="button"
                  className="onboardingPrimaryBtn"
                  onClick={handleNext}
                  id="onboarding-next-btn"
                  autoFocus
                >
                  Next
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="onboardingSkipBtn"
                  onClick={handleSkip}
                  id="onboarding-skip-btn"
                >
                  Skip
                </button>
              </div>
            </>
          )}

          {/* SCREEN 3: DASHBOARD */}
          {currentStep === 3 && (
            <>
              <div
                className="onboardingVisualArea"
                aria-label="Dashboard features illustration"
              >
                <div className="onboardingIllustration">
                  <svg
                    width="220"
                    height="140"
                    viewBox="0 0 220 140"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Dashboard Mini Tiles */}
                    {/* Tile 1: QR Check-in */}
                    <g transform="translate(18, 22)">
                      <rect
                        width="56"
                        height="96"
                        rx="10"
                        fill="#ffffff"
                        stroke="#009973"
                        strokeWidth="1.2"
                      />
                      <rect x="16" y="14" width="24" height="24" rx="4" fill="#e7fff1" />
                      {/* Mini QR icon */}
                      <path
                        d="M22 20h4v4h-4zM30 20h2v2h-2zM22 28h2v2h-2zM28 26h4v4h-4z"
                        fill="#009973"
                      />
                      <text
                        x="28"
                        y="58"
                        fill="#161d1a"
                        fontSize="7.5"
                        fontFamily="DM Sans, sans-serif"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        QR Check-in
                      </text>
                      <text
                        x="28"
                        y="72"
                        fill="#717975"
                        fontSize="6.5"
                        fontFamily="DM Sans, sans-serif"
                        textAnchor="middle"
                      >
                        Fast Entry
                      </text>
                    </g>

                    {/* Tile 2: Ask Spotter / Retrieval records */}
                    <g transform="translate(82, 14)">
                      <rect
                        width="56"
                        height="104"
                        rx="10"
                        fill="#002116"
                        stroke="#00e1a8"
                        strokeWidth="1.5"
                      />
                      <circle cx="28" cy="28" r="14" fill="#00513b" />
                      {/* Search / chat icon */}
                      <circle cx="27" cy="27" r="5" stroke="#45fec3" strokeWidth="1.5" />
                      <path d="M31 31l3 3" stroke="#45fec3" strokeWidth="1.5" strokeLinecap="round" />
                      <text
                        x="28"
                        y="60"
                        fill="#ffffff"
                        fontSize="7.5"
                        fontFamily="DM Sans, sans-serif"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        Gym Records
                      </text>
                      <text
                        x="28"
                        y="74"
                        fill="#bcffe0"
                        fontSize="6.5"
                        fontFamily="DM Sans, sans-serif"
                        textAnchor="middle"
                      >
                        Ask Spotter
                      </text>
                      <rect x="10" y="86" width="36" height="8" rx="4" fill="#009973" />
                      <text
                        x="28"
                        y="92.5"
                        fill="#ffffff"
                        fontSize="5.5"
                        fontFamily="DM Sans, sans-serif"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        READY
                      </text>
                    </g>

                    {/* Tile 3: Member Info */}
                    <g transform="translate(146, 22)">
                      <rect
                        width="56"
                        height="96"
                        rx="10"
                        fill="#ffffff"
                        stroke="#009973"
                        strokeWidth="1.2"
                      />
                      <rect x="16" y="14" width="24" height="24" rx="4" fill="#e7fff1" />
                      {/* User silhouette icon */}
                      <circle cx="28" cy="23" r="4" fill="#009973" />
                      <path
                        d="M20 34c0-4 4-6 8-6s8 2 8 6"
                        stroke="#009973"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <text
                        x="28"
                        y="58"
                        fill="#161d1a"
                        fontSize="7.5"
                        fontFamily="DM Sans, sans-serif"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        My Account
                      </text>
                      <text
                        x="28"
                        y="72"
                        fill="#717975"
                        fontSize="6.5"
                        fontFamily="DM Sans, sans-serif"
                        textAnchor="middle"
                      >
                        All in one
                      </text>
                    </g>
                  </svg>
                </div>
              </div>

              <div className="onboardingContent">
                <h1 className="onboardingTitle" id="onboarding-heading">
                  Your SPOTTER dashboard
                </h1>
                <p className="onboardingBody">
                  Your member information and available services, all in one place.
                </p>
              </div>

              <div className="onboardingActions">
                <button
                  type="button"
                  className="onboardingPrimaryBtn"
                  onClick={handleNext}
                  id="onboarding-get-started-btn"
                  disabled={isCompleting}
                  autoFocus
                >
                  {isCompleting ? "Entering Dashboard..." : "Get Started"}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="onboardingSkipBtn"
                  onClick={handleSkip}
                  id="onboarding-skip-btn"
                  disabled={isCompleting}
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
