"use client";

import React, { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import "./login.css";

type LoginStep = "PHONE" | "VERIFY_OTP" | "SUCCESS";

export default function LoginClient() {
  const router = useRouter();

  const [step, setStep] = useState<LoginStep>("PHONE");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));

  const [errors, setErrors] = useState<{
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedPhone = phoneNumber.replace(/[\s-]/g, "");
    if (!cleanedPhone || cleanedPhone.length < 10) {
      setErrors({
        phoneNumber: "Please enter a valid phone number (at least 10 digits).",
      });
      return;
    }

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
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          otpCode: code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.error || "Verification failed. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      setStep("SUCCESS");
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch {
      setErrors({
        form: "Network error. Unable to verify code.",
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
    <div className="loginPage">
      <div className="loginCard">
        <header className="loginHeader">
          <Link href="/" style={{ textDecoration: "none" }}>
            <h1 className="loginBrand">SPOTTER</h1>
          </Link>
          <h2 className="loginTitle">Member Login</h2>
          <p className="loginSubtitle">
            {step === "PHONE" &&
              "Enter your registered phone number to receive a verification code."}
            {step === "VERIFY_OTP" &&
              `We sent a 6-digit code to ${phoneNumber}`}
            {step === "SUCCESS" && "Welcome back!"}
          </p>
        </header>

        <div className="loginStepIndicator" aria-hidden="true">
          <span
            className={`loginStepDot ${step === "PHONE" ? "loginStepDotActive" : ""}`}
          />
          <span
            className={`loginStepDot ${step === "VERIFY_OTP" ? "loginStepDotActive" : ""}`}
          />
          <span
            className={`loginStepDot ${step === "SUCCESS" ? "loginStepDotActive" : ""}`}
          />
        </div>

        {errors.form && (
          <div className="loginAlertBox loginAlertBoxError" role="alert">
            <p className="loginAlertText">{errors.form}</p>
          </div>
        )}

        {step === "PHONE" && (
          <form className="loginForm" onSubmit={handleSendOtp} noValidate>
            <Input
              id="loginPhoneNumber"
              label="Phone Number"
              type="tel"
              placeholder="e.g. 08012345678"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              error={errors.phoneNumber}
              hint="The phone number registered with the gym."
              required
              disabled={isLoading}
              autoComplete="tel"
            />

            <Button type="submit" isLoading={isLoading} id="login-send-otp">
              Send Verification Code
            </Button>
          </form>
        )}

        {step === "VERIFY_OTP" && (
          <form className="loginForm" onSubmit={handleVerifyOtp} noValidate>
            {devHint && (
              <div className="loginAlertBox" role="status">
                <p className="loginOtpHint">{devHint}</p>
              </div>
            )}

            <div className="fieldGroup">
              <label className="fieldLabel">Verification Code</label>
              <div className="otpInputRow">
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
                    className={`otpDigitInput ${digit ? "otpDigitFilled" : ""}`}
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

            <Button type="submit" isLoading={isLoading} id="login-verify-otp">
              Log In
            </Button>

            <div className="resendRow">
              <span className="resendText">Didn&apos;t get the code?</span>
              <button
                type="button"
                className="resendButton"
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
                setStep("PHONE");
                setOtpDigits(Array(6).fill(""));
                setErrors({});
                setDevHint(null);
              }}
              id="login-change-phone"
            >
              Change Phone Number
            </Button>
          </form>
        )}

        {step === "SUCCESS" && (
          <div className="loginAlertBox" role="status" aria-live="polite">
            <div className="loginSuccessIcon" aria-hidden="true">
              ✓
            </div>
            <p className="loginAlertText" style={{ textAlign: "center" }}>
              Logged in successfully! Redirecting to your dashboard…
            </p>
          </div>
        )}

        <footer className="loginFooter">
          <p className="loginFooterText">
            Not a member yet?{" "}
            <Link href="/signup">Sign up here</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
