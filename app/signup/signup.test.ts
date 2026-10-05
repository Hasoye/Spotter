import { describe, it, expect } from "vitest";

describe("Sign Up Validation Rules", () => {
  it("validates full name requirement", () => {
    const isValidName = (name: string) => name.trim().length >= 2;
    expect(isValidName("Bisi")).toBe(true);
    expect(isValidName("A")).toBe(false);
    expect(isValidName("   ")).toBe(false);
  });

  it("validates phone number digit length", () => {
    const isValidPhone = (phone: string) => {
      const cleaned = phone.replace(/[\s-]/g, "");
      return cleaned.length >= 10 && /^\+?[0-9]+$/.test(cleaned);
    };

    expect(isValidPhone("08012345678")).toBe(true);
    expect(isValidPhone("+2348012345678")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("invalid-phone")).toBe(false);
  });

  it("validates 6-digit SMS OTP format", () => {
    const isValidOtp = (code: string) => /^\d{6}$/.test(code);
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("abc123")).toBe(false);
  });
});
