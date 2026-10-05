import React from "react";
import "./ui.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  id,
  label,
  error,
  hint,
  className = "",
  ...props
}) => {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

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
      <input
        id={id}
        className={`fieldInput ${error ? "fieldInputError" : ""} ${className}`}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {error && (
        <span id={errorId} className="fieldErrorText" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
