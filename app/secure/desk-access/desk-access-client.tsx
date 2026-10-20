"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "../../../components/Input";
import { Button } from "../../../components/Button";
import "../../auth/auth.css";

export default function DeskAccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect") || "/staff";
  const errorParam = searchParams.get("error");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(() => {
    if (errorParam === "session_expired") {
      return "Your staff session has expired. Please sign in again.";
    }
    if (errorParam === "unauthorized_role") {
      return "Access denied: Front desk or authorized staff credentials required.";
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const errors: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      errors.identifier = "Please enter your staff email or phone number.";
    }
    if (!password) {
      errors.password = "Please enter your password.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error || "Login failed. Please check your credentials.");
        setIsLoading(false);
        return;
      }

      // Successful staff authentication -> Redirect to staff dashboard
      router.push(redirectTarget);
      router.refresh();
    } catch {
      setServerError("Network error. Could not connect to the staff authentication service.");
      setIsLoading(false);
    }
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
          <h2 className="authTitle">Staff Desk Access</h2>
          <p className="authSubtitle">Log in with your front desk credentials</p>
        </header>

        {serverError && (
          <div className="authAlert authAlertError" role="alert">
            <p className="authAlertText">{serverError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="authForm" noValidate>
          <Input
            id="desk-identifier"
            label="Staff Email or Phone Number"
            placeholder="e.g. receptionist@spottergym.com"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
            }}
            error={fieldErrors.identifier}
            autoComplete="username"
            disabled={isLoading}
          />

          <Input
            id="desk-password"
            label="Password"
            type="password"
            showPasswordToggle
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
            autoComplete="current-password"
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            style={{ width: "100%", marginTop: "6px" }}
          >
            Sign In to Desk
          </Button>
        </form>
      </div>
    </div>
  );
}
