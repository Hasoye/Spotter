import React from "react";
import "./ui.css";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
}

export const Select: React.FC<SelectProps> = ({
  id,
  label,
  options,
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
        <span id={hintId} className="fieldErrorText">
          {hint}
        </span>
      )}
      <select
        id={id}
        className={`fieldInput ${error ? "fieldInputError" : ""} ${className}`}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={errorId} className="fieldErrorText" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
