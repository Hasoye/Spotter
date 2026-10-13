"use client";

import React, { useState } from "react";
import "./ui.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  showPasswordToggle?: boolean;
}

export const Input: React.FC<InputProps> = ({
  id,
  label,
  error,
  hint,
  type = "text",
  showPasswordToggle,
  className = "",
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordField = type === "password" || showPasswordToggle;

  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  const effectiveType = isPasswordField
    ? showPassword
      ? "text"
      : "password"
    : type;

  return (
    <div className="fieldGroup">
      <label htmlFor={id} className="fieldLabel">
        {label}
      </label>
      {hint && (
        <span id={hintId} className="fieldHintText">
          {hint}
        </span>
      )}
      <div className={isPasswordField ? "fieldInputWrapper" : undefined}>
        <input
          id={id}
          type={effectiveType}
          className={`fieldInput ${error ? "fieldInputError" : ""} ${
            isPasswordField ? "fieldInputWithToggle" : ""
          } ${className}`}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          {...props}
        />
        {isPasswordField && (
          <button
            type="button"
            className="passwordToggleBtn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showPassword ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} className="fieldErrorText" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
