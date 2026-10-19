"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "../../components/Input";
import { Button } from "../../components/Button";
import "./auth.css";

type AuthMode = "login" | "signup" | "forgot";
type LoginStep = "PHONE" | "SUCCESS";
type SignupStep = "REGISTER" | "VERIFY_OTP" | "SUCCESS";
type ForgotStep = "PHONE" | "VERIFY_OTP" | "NEW_PASSWORD" | "SUCCESS";

const EMPTY_FIELD_ERROR = "This field must not be empty";

type FieldErrors = {
  fullName?: string;
  phoneNumber?: string;
  password?: string;
  confirmPassword?: string;
  otpCode?: string;
  termsAccepted?: string;
  form?: string;
};

export const validateFullName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return EMPTY_FIELD_ERROR;
  if (trimmed.length < 2) {
    return "Please enter your full name (at least 2 characters).";
  }
  return undefined;
};

export const normalizePhoneNumberInput = (value: string): string => {
  return value.trim().toLowerCase();
};

export const validatePhoneNumber = (value: string): string | undefined => {
  const normalized = value.trim().toLowerCase();
  const cleaned = normalized.replace(/[\s-]/g, "");
  if (!cleaned) return EMPTY_FIELD_ERROR;
  if (cleaned.length < 10 || !/^\+?[0-9]+$/.test(cleaned)) {
    return "Please enter a valid phone number (at least 10 digits).";
  }
  return undefined;
};

export const validatePassword = (value: string): string | undefined => {
  const normalized = value.trim();
  if (!normalized) return EMPTY_FIELD_ERROR;
  if (normalized.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(normalized)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[a-z]/.test(normalized)) {
    return "Password must contain at least one lowercase letter.";
  }
  if (!/[0-9]/.test(normalized)) {
    return "Password must contain at least one number.";
  }
  return undefined;
};

export const validateLoginPassword = (value: string): string | undefined => {
  const normalized = value.trim();
  if (!normalized) return EMPTY_FIELD_ERROR;
  return undefined;
};

export const validateConfirmPassword = (
  password: string,
  confirmPassword: string
): string | undefined => {
  const normalizedConfirm = confirmPassword.trim();
  if (!normalizedConfirm) return EMPTY_FIELD_ERROR;
  if (password.trim() !== normalizedConfirm) {
    return "Passwords do not match.";
  }
  return undefined;
};

export default function AuthClient({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginStep, setLoginStep] = useState<LoginStep>("PHONE");
  const [signupStep, setSignupStep] = useState<SignupStep>("REGISTER");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("PHONE");

  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(""));

  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  useEffect(() => {
    const urlParam = searchParams.get("mode");
    const urlMode: AuthMode =
      urlParam === "signup"
        ? "signup"
        : urlParam === "forgot"
        ? "forgot"
        : "login";

    setMode((current) => {
      if (current !== urlMode) {
        return urlMode;
      }
      return current;
    });
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

  const switchMode = (next: AuthMode) => {
    setMode(next);
    resetOtp();
    setPassword("");
    setConfirmPassword("");
    clearErrors();
    if (next === "login") {
      setLoginStep("PHONE");
    } else if (next === "signup") {
      setSignupStep("REGISTER");
    } else {
      setForgotStep("PHONE");
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

  const requestOtp = async (reqMode: "signup" | "login"): Promise<boolean> => {
    setIsLoading(true);
    setErrors({});
    setDevHint(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          mode: reqMode,
        }),
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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedPhone = normalizePhoneNumberInput(phoneNumber);
    const normalizedPassword = password.trim();

    const newErrors: FieldErrors = {};
    const phoneError = validatePhoneNumber(normalizedPhone);
    const passError = validateLoginPassword(normalizedPassword);

    if (phoneError) newErrors.phoneNumber = phoneError;
    if (passError) newErrors.password = passError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: normalizedPhone,
          password: normalizedPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.error || "Invalid phone number or password. Please try again.",
        });
        return;
      }

      setLoginStep("SUCCESS");
      if (typeof document !== "undefined") {
        document.cookie =
          "spotter_onboarded=true; path=/; max-age=31536000; SameSite=Lax";
      }
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch {
      setErrors({
        form: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtpSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: FieldErrors = {};
    const nameError = validateFullName(fullName);
    const phoneError = validatePhoneNumber(phoneNumber);
    const passError = validatePassword(password);
    const confirmError = validateConfirmPassword(password, confirmPassword);

    if (nameError) newErrors.fullName = nameError;
    if (phoneError) newErrors.phoneNumber = phoneError;
    if (passError) newErrors.password = passError;
    if (confirmError) newErrors.confirmPassword = confirmError;
    if (!termsAccepted) newErrors.termsAccepted = EMPTY_FIELD_ERROR;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (await requestOtp("signup")) {
      setSignupStep("VERIFY_OTP");
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
          password: password.trim(),
          confirmPassword: confirmPassword.trim(),
          tier: "BASIC",
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
      setTimeout(() => router.push("/onboarding"), 1200);
    } catch {
      setErrors({ form: "Network error. Unable to complete registration." });
    } finally {
      setIsLoading(false);
    }
  };

  // --- Password Reset Handlers ---
  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneError = validatePhoneNumber(phoneNumber);
    if (phoneError) {
      setErrors({ phoneNumber: phoneError });
      return;
    }

    setIsLoading(true);
    setErrors({});
    setDevHint(null);

    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.error || "Failed to process password reset request.",
        });
        return;
      }

      if (data.devHint) {
        setDevHint(data.devHint);
      }

      startResendCooldown();
      setForgotStep("VERIFY_OTP");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setErrors({
        form: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyResetOtpStep = (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setErrors({
        otpCode: "Please enter all 6 digits of the verification code.",
      });
      return;
    }

    setErrors({});
    setForgotStep("NEW_PASSWORD");
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: FieldErrors = {};
    const passError = validatePassword(password);
    const confirmError = validateConfirmPassword(password, confirmPassword);

    if (passError) newErrors.password = passError;
    if (confirmError) newErrors.confirmPassword = confirmError;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          otpCode: otpDigits.join(""),
          password: password.trim(),
          confirmPassword: confirmPassword.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({
          form: data.error || "Password reset failed. Please try again.",
        });
        return;
      }

      setForgotStep("SUCCESS");
      setTimeout(() => switchMode("login"), 2000);
    } catch {
      setErrors({
        form: "Network error. Unable to complete password reset.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    if (mode === "forgot") {
      await handleRequestResetOtp({ preventDefault: () => {} } as React.FormEvent);
    } else {
      await requestOtp(mode);
    }
    resetOtp();
  };

  const normalizedPassword = password.trim();
  const passHasLength = normalizedPassword.length >= 8;
  const passHasUpper = /[A-Z]/.test(normalizedPassword);
  const passHasLower = /[a-z]/.test(normalizedPassword);
  const passHasNumber = /[0-9]/.test(normalizedPassword);

  const isSignupValid =
    Boolean(fullName.trim() && !validateFullName(fullName)) &&
    Boolean(phoneNumber.trim() && !validatePhoneNumber(phoneNumber)) &&
    Boolean(password.trim() && !validatePassword(password)) &&
    Boolean(
      confirmPassword.trim() &&
        !validateConfirmPassword(password, confirmPassword)
    ) &&
    termsAccepted;

  const isLoginValid =
    Boolean(phoneNumber.trim() && !validatePhoneNumber(phoneNumber)) &&
    Boolean(password.trim() && !validateLoginPassword(password));

  const isResetValid =
    Boolean(password.trim() && !validatePassword(password)) &&
    Boolean(
      confirmPassword.trim() &&
        !validateConfirmPassword(password, confirmPassword)
    );

  const getHeaderTitle = () => {
    if (mode === "signup") return "Create Account";
    if (mode === "forgot") {
      if (forgotStep === "NEW_PASSWORD") return "Create New Password";
      if (forgotStep === "VERIFY_OTP") return "Verify SMS Code";
      return "Reset Password";
    }
    return "Welcome back!";
  };

  const getSubtitle = () => {
    if (mode === "signup") {
      return signupStep === "VERIFY_OTP"
        ? `We sent a 6-digit SMS code to ${phoneNumber}`
        : "Join Spotter gym with your phone number";
    }
    if (mode === "forgot") {
      if (forgotStep === "VERIFY_OTP") {
        return `We sent a 6-digit SMS code to ${phoneNumber}`;
      }
      if (forgotStep === "NEW_PASSWORD") {
        return "Create and confirm your new secure password";
      }
      return "Enter your registered phone number to reset your password";
    }
    return "Log in with your phone number and password";
  };

  return (
    <div className="authPage">
      <div className="authCard">
        <header className="authHeader">
          <Link href="/" style={{ textDecoration: "none" }}>
            <img
              src="/icon.svg"
              alt="SPOTTER"
              width="36"
              height="36"
              style={{ margin: "0 auto", display: "block" }}
            />
          </Link>
          <h2 className="authTitle">{getHeaderTitle()}</h2>
          <p className="authSubtitle">{getSubtitle()}</p>
        </header>

        {errors.form && (
          <div className="authAlert authAlertError" role="alert">
            <p className="authAlertText">{errors.form}</p>
          </div>
        )}

        {/* --- LOGIN FLOW --- */}
        {mode === "login" && (
          <>
            {loginStep === "PHONE" && (
              <form
                className="authForm"
                onSubmit={handlePasswordLogin}
                noValidate
              >
                <Input
                  id="loginPhoneNumber"
                  label="Phone Number"
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (errors.phoneNumber) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.phoneNumber;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const normalized = normalizePhoneNumberInput(phoneNumber);
                    setPhoneNumber(normalized);
                    const err = validatePhoneNumber(normalized);
                    if (err)
                      setErrors((prev) => ({ ...prev, phoneNumber: err }));
                  }}
                  error={errors.phoneNumber}
                  required
                  disabled={isLoading}
                  autoComplete="tel"
                />

                <Input
                  id="loginPassword"
                  label="Password"
                  type="password"
                  showPasswordToggle
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.password;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const err = validateLoginPassword(password);
                    if (err) setErrors((prev) => ({ ...prev, password: err }));
                  }}
                  error={errors.password}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />

                <div className="authForgotPasswordRow">
                  <button
                    type="button"
                    className="authSecondaryLink"
                    onClick={() => switchMode("forgot")}
                    id="login-forgot-password"
                  >
                    Forgot Password?
                  </button>
                </div>

                <Button
                  type="submit"
                  isLoading={isLoading}
                  id="login-submit"
                  disabled={!isLoginValid || isLoading}
                >
                  Log In
                </Button>
              </form>
            )}

            {loginStep === "SUCCESS" && (
              <div className="authAlert" role="status" aria-live="polite">
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

        {/* --- SIGNUP FLOW --- */}
        {mode === "signup" && (
          <>
            {signupStep === "REGISTER" && (
              <form
                className="authForm"
                onSubmit={handleSendOtpSignup}
                noValidate
              >
                <Input
                  id="signupFullName"
                  label="Full Name"
                  type="text"
                  placeholder="e.g. Bisi Akande"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.fullName;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const err = validateFullName(fullName);
                    if (err) setErrors((prev) => ({ ...prev, fullName: err }));
                  }}
                  error={errors.fullName}
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
                    if (errors.phoneNumber) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.phoneNumber;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const err = validatePhoneNumber(phoneNumber);
                    if (err)
                      setErrors((prev) => ({ ...prev, phoneNumber: err }));
                  }}
                  error={errors.phoneNumber}
                  required
                  disabled={isLoading}
                  autoComplete="tel"
                />

                <Input
                  id="signupPassword"
                  label="Password"
                  type="password"
                  showPasswordToggle
                  placeholder="Create a secure password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.password;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const err = validatePassword(password);
                    if (err) setErrors((prev) => ({ ...prev, password: err }));
                  }}
                  error={errors.password}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />

                {password.length > 0 && (
                  <div className="passwordChecklist" aria-live="polite">
                    <span
                      className={`passwordChecklistItem ${
                        passHasLength ? "passwordChecklistItemMet" : ""
                      }`}
                    >
                      <span className="passwordChecklistDot">
                        {passHasLength ? "✓" : "○"}
                      </span>
                      At least 8 characters
                    </span>
                    <span
                      className={`passwordChecklistItem ${
                        passHasUpper ? "passwordChecklistItemMet" : ""
                      }`}
                    >
                      <span className="passwordChecklistDot">
                        {passHasUpper ? "✓" : "○"}
                      </span>
                      One uppercase letter
                    </span>
                    <span
                      className={`passwordChecklistItem ${
                        passHasLower ? "passwordChecklistItemMet" : ""
                      }`}
                    >
                      <span className="passwordChecklistDot">
                        {passHasLower ? "✓" : "○"}
                      </span>
                      One lowercase letter
                    </span>
                    <span
                      className={`passwordChecklistItem ${
                        passHasNumber ? "passwordChecklistItemMet" : ""
                      }`}
                    >
                      <span className="passwordChecklistDot">
                        {passHasNumber ? "✓" : "○"}
                      </span>
                      One number
                    </span>
                  </div>
                )}

                <Input
                  id="signupConfirmPassword"
                  label="Confirm Password"
                  type="password"
                  showPasswordToggle
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.confirmPassword;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const err = validateConfirmPassword(
                      password,
                      confirmPassword
                    );
                    if (err)
                      setErrors((prev) => ({ ...prev, confirmPassword: err }));
                  }}
                  error={errors.confirmPassword}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
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
                        if (e.target.checked && errors.termsAccepted) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.termsAccepted;
                            return next;
                          });
                        }
                      }}
                      disabled={isLoading}
                      required
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
                      Please accept the terms and conditions to proceed.
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  isLoading={isLoading}
                  id="signup-send-otp"
                  disabled={!isSignupValid || isLoading}
                >
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
                  <div className="authAlert" role="status">
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
              <div className="authAlert" role="status" aria-live="polite">
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

        {/* --- FORGOT / RESET PASSWORD FLOW --- */}
        {mode === "forgot" && (
          <>
            {forgotStep === "PHONE" && (
              <form
                className="authForm"
                onSubmit={handleRequestResetOtp}
                noValidate
              >
                <Input
                  id="forgotPhoneNumber"
                  label="Registered Phone Number"
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (errors.phoneNumber) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.phoneNumber;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const err = validatePhoneNumber(phoneNumber);
                    if (err)
                      setErrors((prev) => ({ ...prev, phoneNumber: err }));
                  }}
                  error={errors.phoneNumber}
                  required
                  disabled={isLoading}
                  autoComplete="tel"
                />

                <Button
                  type="submit"
                  isLoading={isLoading}
                  id="forgot-send-otp"
                  disabled={
                    !phoneNumber.trim() ||
                    Boolean(validatePhoneNumber(phoneNumber)) ||
                    isLoading
                  }
                >
                  Send Verification Code
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLoading}
                  onClick={() => switchMode("login")}
                  id="forgot-back-login"
                >
                  Back to Login
                </Button>
              </form>
            )}

            {forgotStep === "VERIFY_OTP" && (
              <form
                className="authForm"
                onSubmit={handleVerifyResetOtpStep}
                noValidate
              >
                {devHint && (
                  <div className="authAlert" role="status">
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
                  id="forgot-verify-code"
                  disabled={otpDigits.join("").length !== 6 || isLoading}
                >
                  Continue to New Password
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
                    setForgotStep("PHONE");
                    resetOtp();
                    clearErrors();
                  }}
                  id="forgot-change-phone"
                >
                  Change Phone Number
                </Button>
              </form>
            )}

            {forgotStep === "NEW_PASSWORD" && (
              <form
                className="authForm"
                onSubmit={handleCompleteReset}
                noValidate
              >
                <Input
                  id="resetPassword"
                  label="New Password"
                  type="password"
                  showPasswordToggle
                  placeholder="Create a new password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.password;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const err = validatePassword(password);
                    if (err) setErrors((prev) => ({ ...prev, password: err }));
                  }}
                  error={errors.password}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />

                {password.length > 0 && (
                  <div className="passwordChecklist" aria-live="polite">
                    <span
                      className={`passwordChecklistItem ${
                        passHasLength ? "passwordChecklistItemMet" : ""
                      }`}
                    >
                      <span className="passwordChecklistDot">
                        {passHasLength ? "✓" : "○"}
                      </span>
                      At least 8 characters
                    </span>
                    <span
                      className={`passwordChecklistItem ${
                        passHasUpper ? "passwordChecklistItemMet" : ""
                      }`}
                    >
                      <span className="passwordChecklistDot">
                        {passHasUpper ? "✓" : "○"}
                      </span>
                      One uppercase letter
                    </span>
                    <span
                      className={`passwordChecklistItem ${
                        passHasLower ? "passwordChecklistItemMet" : ""
                      }`}
                    >
                      <span className="passwordChecklistDot">
                        {passHasLower ? "✓" : "○"}
                      </span>
                      One lowercase letter
                    </span>
                    <span
                      className={`passwordChecklistItem ${
                        passHasNumber ? "passwordChecklistItemMet" : ""
                      }`}
                    >
                      <span className="passwordChecklistDot">
                        {passHasNumber ? "✓" : "○"}
                      </span>
                      One number
                    </span>
                  </div>
                )}

                <Input
                  id="resetConfirmPassword"
                  label="Confirm New Password"
                  type="password"
                  showPasswordToggle
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.confirmPassword;
                        return next;
                      });
                    }
                  }}
                  onBlur={() => {
                    const err = validateConfirmPassword(
                      password,
                      confirmPassword
                    );
                    if (err)
                      setErrors((prev) => ({ ...prev, confirmPassword: err }));
                  }}
                  error={errors.confirmPassword}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />

                <Button
                  type="submit"
                  isLoading={isLoading}
                  id="forgot-submit-reset"
                  disabled={!isResetValid || isLoading}
                >
                  Reset Password
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLoading}
                  onClick={() => switchMode("login")}
                  id="forgot-cancel-login"
                >
                  Cancel and Return to Login
                </Button>
              </form>
            )}

            {forgotStep === "SUCCESS" && (
              <div className="authAlert" role="status" aria-live="polite">
                <div className="authSuccessIcon" aria-hidden="true">
                  ✓
                </div>
                <p className="authAlertText" style={{ textAlign: "center" }}>
                  Password reset successfully! Redirecting to login…
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
                  Sign up
                </button>
              </>
            ) : mode === "signup" ? (
              <>
                Already a member?{" "}
                <button
                  type="button"
                  className="authFooterLink"
                  onClick={() => switchMode("login")}
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                Remember your password?{" "}
                <button
                  type="button"
                  className="authFooterLink"
                  onClick={() => switchMode("login")}
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </footer>
      </div>
    </div>
  );
}
