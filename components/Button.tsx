import React from "react";
import "./ui.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  isLoading = false,
  disabled,
  className = "",
  ...props
}) => {
  const btnClass = variant === "secondary" ? "secondaryButton" : "primaryButton";

  return (
    <button
      className={`${btnClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "Processing..." : children}
    </button>
  );
};
