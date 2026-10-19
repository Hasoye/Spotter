import { z } from "zod";

/**
 * Normalizes phone number input by trimming whitespace and converting to lowercase.
 */
export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.trim().toLowerCase();
}

/**
 * Standard phone number schema conforming to Nigerian mobile/international formats.
 * Requires at least 10 digits and valid characters.
 * Enforces trim and lowercase normalization.
 */
export const phoneNumberSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(10, "Phone number must be at least 10 digits")
  .regex(/^\+?[0-9\s-]+$/, "Invalid phone number format");

/**
 * 6-digit numeric SMS verification code schema per AGENTS.md login specification.
 */
export const otpCodeSchema = z
  .string()
  .trim()
  .length(6, "Verification code must be exactly 6 digits")
  .regex(/^\d{6}$/, "Verification code must contain only numbers");

/**
 * Member full name schema.
 */
export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Full name must be at least 2 characters long")
  .max(100, "Full name is too long");

/**
 * Password schema with required complexity and whitespace normalization.
 * Normalization trims leading/trailing whitespace while preserving internal spaces.
 * Validation occurs after normalization:
 * - minimum 8 characters
 * - at least one uppercase letter
 * - at least one lowercase letter
 * - at least one number
 */
export const passwordSchema = z
  .string()
  .trim()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Membership tier schema matching Prisma schema Tier enum.
 */
export const membershipTierSchema = z
  .enum(["BASIC", "PREMIUM"])
  .default("BASIC");

/**
 * Server validation schema for POST /api/auth/send-otp
 */
export const sendOtpSchema = z.object({
  phoneNumber: phoneNumberSchema,
  mode: z.enum(["signup", "login"]).default("signup"),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

/**
 * Login password schema requiring a non-empty password without enforcing signup complexity.
 */
export const loginPasswordSchema = z
  .string()
  .trim()
  .min(1, "Password is required");

/**
 * Server validation schema for POST /api/auth/login
 * Supports password authentication while keeping otpCode optional for backward-compatibility.
 */
export const loginSchema = z.object({
  phoneNumber: phoneNumberSchema,
  password: loginPasswordSchema,
  otpCode: otpCodeSchema.optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Server validation schema for POST /api/auth/signup
 * Requires password and confirmPassword matching.
 */
export const signupSchema = z
  .object({
    fullName: fullNameSchema,
    phoneNumber: phoneNumberSchema,
    password: passwordSchema,
    confirmPassword: z.string().trim(),
    tier: membershipTierSchema,
    otpCode: otpCodeSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Server validation schema for POST /api/auth/reset-password/request
 */
export const requestResetSchema = z.object({
  phoneNumber: phoneNumberSchema,
});

export type RequestResetInput = z.infer<typeof requestResetSchema>;

/**
 * Server validation schema for POST /api/auth/reset-password
 * Requires valid phone, 6-digit OTP, and matching new password conforming to password rules.
 */
export const resetPasswordSchema = z
  .object({
    phoneNumber: phoneNumberSchema,
    otpCode: otpCodeSchema,
    password: passwordSchema,
    confirmPassword: z.string().trim(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
