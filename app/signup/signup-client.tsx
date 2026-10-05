"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Button } from "../../components/Button";
import "./signup.css";

type SignupStep = "REGISTER" | "VERIFY_OTP" | "SUCCESS";

export default function SignupClient() {
  const router = useRouter();

  const [step, setStep] = useState<SignupStep>("REGISTER");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [tier, setTier] = useState<"BASIC" | "PREMIUM">("BASIC");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));

  const [errors, setErrors] = useState<{
    fullName?: string;
    phoneNumber?: string;
    otpCode?: string;
    form?: string;
  }>({});

  const [isLoading, setIsLoading] = useState(false);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  const startResendCooldown = useCallback(() => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const validateStep1 = () => {
    const newErrors: { fullName?: string; phoneNumber?: string } = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      newErrors.fullName =
        "Please enter your full name (at least 2 characters).";
    }

    const cleanedPhone = phoneNumber.replace(/[\s-]/g, "");
    if (!cleanedPhone || cleanedPhone.length < 10) {
      newErrors.phoneNumber =
        "Please enter a valid phone number (at least 10 digits).";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1()) return;

    setIsLoading(true);
    setErrors({});
    setDevHint(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.error || "Failed to send verification code.",
        });
        setIsLoading(false);
        return;
      }

      if (data.devHint) {
        setDevHint(data.devHint);
      }

      setStep("VERIFY_OTP");
      startResendCooldown();

      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    } catch {
      setErrors({
        form: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setOtpDigits(newDigits);

    const nextEmpty = newDigits.findIndex((d) => !d);
    if (nextEmpty === -1) {
      otpRefs.current[5]?.focus();
    } else {
      otpRefs.current[nextEmpty]?.focus();
    }
  };

  const handleVerifyAndSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = otpDigits.join("");
    if (code.length !== 6) {
      setErrors({
        otpCode: "Please enter all 6 digits of the verification code.",
      });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          tier,
          otpCode: code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.error || "Sign up failed. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      setStep("SUCCESS");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch {
      setErrors({
        form: "Network error. Unable to complete registration.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setErrors({});
    setDevHint(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.error || "Failed to resend verification code.",
        });
        setIsLoading(false);
        return;
      }

      if (data.devHint) {
        setDevHint(data.devHint);
      }

      setOtpDigits(Array(6).fill(""));
      startResendCooldown();
      otpRefs.current[0]?.focus();
    } catch {
      setErrors({
        form: "Network error. Could not resend code.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signupPage">
      <div className="signupCard">
        <header className="signupHeader">
          <Link href="/" style={{ textDecoration: "none" }}>
            <h1 className="signupBrand">SPOTTER</h1>
          </Link>
          <h2 className="signupTitle">Member Registration</h2>
          <p className="signupSubtitle">
            {step === "REGISTER" &&
              "Enter your details to create your SPOTTER gym account."}
            {step === "VERIFY_OTP" &&
              `We sent a 6-digit code to ${phoneNumber}`}
            {step === "SUCCESS" && "Welcome to SPOTTER!"}
          </p>
        </header>

        <div className="signupStepIndicator" aria-hidden="true">
          <span
            className={`signupStepDot ${step === "REGISTER" ? "signupStepDotActive" : ""}`}
          />
          <span
            className={`signupStepDot ${step === "VERIFY_OTP" ? "signupStepDotActive" : ""}`}
          />
          <span
            className={`signupStepDot ${step === "SUCCESS" ? "signupStepDotActive" : ""}`}
          />
        </div>

        {errors.form && (
          <div className="alertBox alertBoxError" role="alert">
            <p className="alertText">{errors.form}</p>
          </div>
        )}

        {step === "REGISTER" && (
          <form className="signupForm" onSubmit={handleSendOtp} noValidate>
            <Input
              id="fullName"
              label="Full Name"
              type="text"
              placeholder="e.g. Bisi Akande"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              required
              disabled={isLoading}
              autoComplete="name"
            />

            <Input
              id="phoneNumber"
              label="Phone Number"
              type="tel"
              placeholder="e.g. 08012345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              error={errors.phoneNumber}
              hint="Your registered phone number is used for SMS OTP login."
              required
              disabled={isLoading}
              autoComplete="tel"
            />

            <Select
              id="tier"
              label="Membership Tier"
              value={tier}
              onChange={(e) =>
                setTier(e.target.value as "BASIC" | "PREMIUM")
              }
              options={[
                { value: "BASIC", label: "Basic Tier" },
                { value: "PREMIUM", label: "Premium Tier" },
              ]}
              disabled={isLoading}
            />

            <div className="tierInfoBox">
              <p className="tierTitle">
                {tier === "BASIC"
                  ? "Basic Tier Includes:"
                  : "Premium Tier Includes:"}
              </p>
              <p className="tierDesc">
                {tier === "BASIC"
                  ? "Access hours, timetable, gym rules, prices, personal attendance, and balance history."
                  : "All Basic features plus access to written customized training plans."}
              </p>
            </div>

            <Button type="submit" isLoading={isLoading} id="signup-send-otp">
              Send Verification Code
            </Button>
          </form>
        )}

        {step === "VERIFY_OTP" && (
          <form
            className="signupForm"
            onSubmit={handleVerifyAndSignup}
            noValidate
          >
            {devHint && (
              <div className="alertBox" role="status">
                <p className="otpHint">{devHint}</p>
              </div>
            )}

            <div className="fieldGroup">
              <label className="fieldLabel">Verification Code</label>
              <div className="signupOtpInputRow">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) =>
                      handleOtpDigitChange(index, e.target.value)
                    }
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={index === 0 ? handleOtpPaste : undefined}
                    className={`signupOtpDigitInput ${digit ? "signupOtpDigitFilled" : ""}`}
                    aria-label={`Digit ${index + 1} of 6`}
                    disabled={isLoading}
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                  />
                ))}
              </div>
              {errors.otpCode && (
                <span className="fieldErrorText" role="alert">
                  {errors.otpCode}
                </span>
              )}
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              id="signup-verify-otp"
            >
              Complete Registration
            </Button>

            <div className="signupResendRow">
              <span className="signupResendText">
                Didn&apos;t get the code?
              </span>
              <button
                type="button"
                className="signupResendButton"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || isLoading}
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend Code"}
              </button>
            </div>

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => {
                setStep("REGISTER");
                setOtpDigits(Array(6).fill(""));
                setErrors({});
                setDevHint(null);
              }}
              id="signup-change-details"
            >
              Change Details
            </Button>
          </form>
        )}

        {step === "SUCCESS" && (
          <div className="alertBox" role="status" aria-live="polite">
            <div className="signupSuccessIcon" aria-hidden="true">
              ✓
            </div>
            <p className="alertText" style={{ textAlign: "center" }}>
              Account created successfully! Redirecting to your dashboard…
            </p>
          </div>
        )}

        <footer className="loginLinkContainer">
          <p className="loginText">
            Already a member?{" "}
            <Link href="/login">Log in here</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
