"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "../../components/Input";
import { Select } from "../../components/Select";
import { Button } from "../../components/Button";
import "./auth.css";

type AuthMode = "login" | "signup";
type LoginStep = "PHONE" | "VERIFY_OTP" | "SUCCESS";
type SignupStep = "REGISTER" | "VERIFY_OTP" | "SUCCESS";

const EMPTY_FIELD_ERROR = "This field must not be empty";

type FieldErrors = {
  fullName?: string;
  phoneNumber?: string;
  otpCode?: string;
  termsAccepted?: string;
  form?: string;
};

const validateFullName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return EMPTY_FIELD_ERROR;
  if (trimmed.length < 2) {
    return "Please enter your full name (at least 2 characters).";
  }
  if (trimmed.split(/\s+/).length < 2) {
    return "Please enter at least two names separated by a space.";
  }
  return undefined;
};

const validatePhoneNumber = (value: string): string | undefined => {
  const cleaned = value.replace(/[\s-]/g, "");
  if (!cleaned) return EMPTY_FIELD_ERROR;
  if (cleaned.length < 10 || !/^\+?[0-9]+$/.test(cleaned)) {
    return "Please enter a valid phone number (at least 10 digits).";
  }
  return undefined;
};

export default function AuthClient({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginStep, setLoginStep] = useState<LoginStep>("PHONE");
  const [signupStep, setSignupStep] = useState<SignupStep>("REGISTER");

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [tier, setTier] = useState<"BASIC" | "PREMIUM">("BASIC");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  useEffect(() => {
    const urlMode = searchParams.get("mode") === "signup" ? "signup" : "login";
    setMode((current) => (current === urlMode ? current : urlMode));
  }, [searchParams]);

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

  const resetOtp = () => setOtpDigits(Array(6).fill(""));

  const clearErrors = () => {
    setErrors({});
    setDevHint(null);
  };

  const clearFieldError = (field: "fullName" | "phoneNumber") => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleBlur = (field: "fullName" | "phoneNumber", value: string) => {
    const error =
      field === "fullName"
        ? validateFullName(value)
        : validatePhoneNumber(value);

    setErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[field] = error;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    resetOtp();
    clearErrors();
    if (next === "login") {
      setLoginStep("PHONE");
    } else {
      setSignupStep("REGISTER");
    }
    router.replace(`/auth?mode=${next}`);
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    if (errors.otpCode) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.otpCode;
        return next;
      });
    }

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
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  };

  const requestOtp = async (): Promise<boolean> => {
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
        return false;
      }

      if (data.devHint) {
        setDevHint(data.devHint);
      }

      startResendCooldown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
      return true;
    } catch {
      setErrors({
        form: "Network error. Please check your connection and try again.",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneError = validatePhoneNumber(phoneNumber);
    if (phoneError) {
      setErrors({ phoneNumber: phoneError });
      return;
    }

    if (await requestOtp()) {
      setLoginStep("VERIFY_OTP");
    }
  };

  const handleSendOtpSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: FieldErrors = {};
    const nameError = validateFullName(fullName);
    const phoneError = validatePhoneNumber(phoneNumber);

    if (nameError) newErrors.fullName = nameError;
    if (phoneError) newErrors.phoneNumber = phoneError;
    if (!termsAccepted) newErrors.termsAccepted = EMPTY_FIELD_ERROR;

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (await requestOtp()) {
      setSignupStep("VERIFY_OTP");
    }
  };

  const handleVerifyLogin = async (e: React.FormEvent) => {
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
        return;
      }

      setLoginStep("SUCCESS");
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch {
      setErrors({ form: "Network error. Unable to verify code." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySignup = async (e: React.FormEvent) => {
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
        return;
      }

      setSignupStep("SUCCESS");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setErrors({ form: "Network error. Unable to complete registration." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    await requestOtp();
    resetOtp();
  };

  const subtitle =
    mode === "login"
      ? loginStep === "PHONE"
        ? "Enter your registered phone number to receive a verification code."
        : loginStep === "VERIFY_OTP"
          ? `We sent a 6-digit code to ${phoneNumber}`
          : "Welcome back!"
      : signupStep === "REGISTER"
        ? "Enter your details to create your SPOTTER gym account."
        : signupStep === "VERIFY_OTP"
          ? `We sent a 6-digit code to ${phoneNumber}`
          : "Welcome to SPOTTER!";

  const activeStep = mode === "login" ? loginStep : signupStep;

  return (
    <div className="authPage">
      <div className="authCard">
        <header className="authHeader">
          <Link href="/" style={{ textDecoration: "none" }}>
            <img
              src="/icon.svg"
              alt="SPOTTER"
              width="48"
              height="48"
              style={{ margin: "0 auto", display: "block" }}
            />
          </Link>
          <h2 className="authTitle">
            {mode === "login" ? "Member Login" : "Member Registration"}
          </h2>
          <p className="authSubtitle">{subtitle}</p>
        </header>

        <div className="authTabs" role="tablist" aria-label="Authentication">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={`authTab ${mode === "login" ? "authTabActive" : ""}`}
            onClick={() => switchMode("login")}
          >
            Log In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`authTab ${mode === "signup" ? "authTabActive" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Sign Up
          </button>
        </div>

        <div className="authStepIndicator" aria-hidden="true">
          <span
            className={`authStepDot ${
              activeStep !== (mode === "login" ? "PHONE" : "REGISTER")
                ? "authStepDotActive"
                : ""
            }`}
          />
          <span
            className={`authStepDot ${
              activeStep === "SUCCESS" ? "authStepDotActive" : ""
            }`}
          />
          <span
            className={`authStepDot ${
              activeStep === "SUCCESS" ? "authStepDotActive" : ""
            }`}
          />
        </div>

        {errors.form && (
          <div className="authAlertBox authAlertBoxError" role="alert">
            <p className="authAlertText">{errors.form}</p>
          </div>
        )}

        {mode === "login" && (
          <>
            {loginStep === "PHONE" && (
              <form className="authForm" onSubmit={handleSendOtpLogin} noValidate>
                <Input
                  id="loginPhoneNumber"
                  label="Phone Number"
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    clearFieldError("phoneNumber");
                  }}
                  onBlur={(e) => handleBlur("phoneNumber", e.target.value)}
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

            {loginStep === "VERIFY_OTP" && (
              <form className="authForm" onSubmit={handleVerifyLogin} noValidate>
                {devHint && (
                  <div className="authAlertBox" role="status">
                    <p className="authOtpHint">{devHint}</p>
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
                        className={`otpDigitInput ${
                          digit ? "otpDigitFilled" : ""
                        } ${errors.otpCode ? "otpDigitInputError" : ""}`}
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

                <div className="authResendRow">
                  <span className="authResendText">
                    Didn&apos;t get the code?
                  </span>
                  <button
                    type="button"
                    className="authResendButton"
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
                    setLoginStep("PHONE");
                    resetOtp();
                    clearErrors();
                  }}
                  id="login-change-phone"
                >
                  Change Phone Number
                </Button>
              </form>
            )}

            {loginStep === "SUCCESS" && (
              <div className="authAlertBox" role="status" aria-live="polite">
                <div className="authSuccessIcon" aria-hidden="true">
                  ✓
                </div>
                <p className="authAlertText" style={{ textAlign: "center" }}>
                  Logged in successfully! Redirecting to your dashboard…
                </p>
              </div>
            )}
          </>
        )}

        {mode === "signup" && (
          <>
            {signupStep === "REGISTER" && (
              <form className="authForm" onSubmit={handleSendOtpSignup} noValidate>
                <Input
                  id="fullName"
                  label="Full Name"
                  type="text"
                  placeholder="e.g. Bisi Akande"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearFieldError("fullName");
                  }}
                  onBlur={(e) => handleBlur("fullName", e.target.value)}
                  error={errors.fullName}
                  hint="First and last name."
                  required
                  disabled={isLoading}
                  autoComplete="name"
                />

                <Input
                  id="signupPhoneNumber"
                  label="Phone Number"
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    clearFieldError("phoneNumber");
                  }}
                  onBlur={(e) => handleBlur("phoneNumber", e.target.value)}
                  error={errors.phoneNumber}
                  hint="Used for SMS OTP login."
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

                <div className="authCheckboxGroup">
                  <label
                    className={`authCheckboxLabel ${
                      errors.termsAccepted ? "authCheckboxLabelError" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="termsAccepted"
                      checked={termsAccepted}
                      onChange={(e) => {
                        setTermsAccepted(e.target.checked);
                        if (e.target.checked) {
                          setErrors((prev) => {
                            if (!prev.termsAccepted) return prev;
                            const next = { ...prev };
                            delete next.termsAccepted;
                            return next;
                          });
                        }
                      }}
                      disabled={isLoading}
                    />
                    <span className="authCheckboxText">
                      I agree to the{" "}
                      <Link
                        href="/?view=terms"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Terms and Conditions
                      </Link>
                    </span>
                  </label>
                  {errors.termsAccepted && (
                    <span className="fieldErrorText" role="alert">
                      {errors.termsAccepted}
                    </span>
                  )}
                </div>

                <Button type="submit" isLoading={isLoading} id="signup-send-otp">
                  Send Verification Code
                </Button>
              </form>
            )}

            {signupStep === "VERIFY_OTP" && (
              <form
                className="authForm"
                onSubmit={handleVerifySignup}
                noValidate
              >
                {devHint && (
                  <div className="authAlertBox" role="status">
                    <p className="authOtpHint">{devHint}</p>
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
                        className={`otpDigitInput ${
                          digit ? "otpDigitFilled" : ""
                        } ${errors.otpCode ? "otpDigitInputError" : ""}`}
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

                <div className="authResendRow">
                  <span className="authResendText">
                    Didn&apos;t get the code?
                  </span>
                  <button
                    type="button"
                    className="authResendButton"
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
                    setSignupStep("REGISTER");
                    resetOtp();
                    clearErrors();
                  }}
                  id="signup-change-details"
                >
                  Change Details
                </Button>
              </form>
            )}

            {signupStep === "SUCCESS" && (
              <div className="authAlertBox" role="status" aria-live="polite">
                <div className="authSuccessIcon" aria-hidden="true">
                  ✓
                </div>
                <p className="authAlertText" style={{ textAlign: "center" }}>
                  Account created successfully! Redirecting to your dashboard…
                </p>
              </div>
            )}
          </>
        )}

        <footer className="authFooter">
          <p className="authFooterText">
            {mode === "login" ? (
              <>
                Not a member yet?{" "}
                <button
                  type="button"
                  className="authFooterLink"
                  onClick={() => switchMode("signup")}
                >
                  Sign up here
                </button>
              </>
            ) : (
              <>
                Already a member?{" "}
                <button
                  type="button"
                  className="authFooterLink"
                  onClick={() => switchMode("login")}
                >
                  Log in here
                </button>
              </>
            )}
          </p>
        </footer>
      </div>
    </div>
  );
}
