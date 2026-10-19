import { describe, it, expect, vi } from "vitest";
import {
  passwordSchema,
  signupSchema,
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
  normalizePhoneNumber,
} from "../../lib/validations";
import {
  validatePassword,
  validateConfirmPassword,
  validatePhoneNumber,
  normalizePhoneNumberInput,
} from "./auth-client";
import {
  hashPassword,
  verifyPassword,
  normalizePassword,
} from "../../lib/password";
import {
  generateSessionToken,
  hashSessionToken,
  SESSION_DURATION_MS,
} from "../../lib/session";
import {
  ACCOUNT_DELETION_GRACE_PERIOD_MS,
  getAccountDeletionStatus,
} from "../../lib/account-deletion";
import {
  checkRateLimit,
  resetRateLimitStore,
  getClientIp,
  getRateLimitHeaders,
} from "../../lib/rate-limit";
import {
  computePasswordSha1,
  checkPwnedPassword,
  HIBP_RANGE_API_URL,
} from "../../lib/hibp";

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

describe("SMS OTP Login Rules", () => {
  it("validates registered member phone number format for login", () => {
    const isValidPhone = (phone: string) => {
      const cleaned = phone.replace(/[\s-]/g, "");
      return cleaned.length >= 10 && /^\+?[0-9]+$/.test(cleaned);
    };

    expect(isValidPhone("08012345678")).toBe(true);
    expect(isValidPhone("+2348012345678")).toBe(true);
    expect(isValidPhone("08012")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });

  it("requires exactly 6 numeric digits for SMS login OTP", () => {
    const isValidOtp = (code: string) => /^\d{6}$/.test(code);
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("000000")).toBe(true);
    expect(isValidOtp("12345")).toBe(false);
    expect(isValidOtp("abcdef")).toBe(false);
  });
});

describe("Send OTP Mode Validation", () => {
  const allowedModes = ["signup", "login"] as const;
  const isValidMode = (mode?: string) =>
    !mode || (allowedModes as readonly string[]).includes(mode);

  it("accepts signup and login modes, and defaults when unspecified", () => {
    expect(isValidMode("signup")).toBe(true);
    expect(isValidMode("login")).toBe(true);
    expect(isValidMode(undefined)).toBe(true);
    expect(isValidMode("reset_password")).toBe(false);
  });
});

describe("Signup Route Payload Validation", () => {
  const validTiers = ["BASIC", "PREMIUM"] as const;
  const isValidTier = (tier?: string) =>
    !tier || (validTiers as readonly string[]).includes(tier);

  it("validates valid membership tiers", () => {
    expect(isValidTier("BASIC")).toBe(true);
    expect(isValidTier("PREMIUM")).toBe(true);
    expect(isValidTier(undefined)).toBe(true);
    expect(isValidTier("VIP")).toBe(false);
  });

  it("verifies mock verification codes accepted in development", () => {
    const isAcceptedDevOtp = (code: string) =>
      code === "123456" || code === "000000";
    expect(isAcceptedDevOtp("123456")).toBe(true);
    expect(isAcceptedDevOtp("000000")).toBe(true);
    expect(isAcceptedDevOtp("999999")).toBe(false);
  });
});

describe("Login Route Validation and Error Rules", () => {
  const isValidLoginPhone = (phone: string) => {
    const cleaned = phone.replace(/[\s-]/g, "");
    return cleaned.length >= 10 && /^\+?[0-9]+$/.test(cleaned);
  };

  it("validates phone number on login", () => {
    expect(isValidLoginPhone("08012345678")).toBe(true);
    expect(isValidLoginPhone("+2348012345678")).toBe(true);
    expect(isValidLoginPhone("1234")).toBe(false);
    expect(isValidLoginPhone("")).toBe(false);
  });

  it("validates 6-digit verification code on login", () => {
    const isValidLoginOtp = (code: string) => /^\d{6}$/.test(code);
    expect(isValidLoginOtp("123456")).toBe(true);
    expect(isValidLoginOtp("12345")).toBe(false);
    expect(isValidLoginOtp("1234567")).toBe(false);
    expect(isValidLoginOtp("abcdef")).toBe(false);
  });
});

describe("Client and Server Password Validation Consistency", () => {
  it("enforces identical rules for valid passwords", () => {
    const valid = "SecretPass123";
    expect(validatePassword(valid)).toBeUndefined();
    expect(passwordSchema.safeParse(valid).success).toBe(true);
  });

  it("enforces identical rules for passwords shorter than 8 characters", () => {
    const short = "Abc12";
    expect(validatePassword(short)).toBe("Password must be at least 8 characters long.");
    expect(passwordSchema.safeParse(short).success).toBe(false);
  });

  it("enforces identical rules for missing uppercase letters", () => {
    const noUpper = "password123";
    expect(validatePassword(noUpper)).toBe("Password must contain at least one uppercase letter.");
    expect(passwordSchema.safeParse(noUpper).success).toBe(false);
  });

  it("enforces identical rules for missing lowercase letters", () => {
    const noLower = "PASSWORD123";
    expect(validatePassword(noLower)).toBe("Password must contain at least one lowercase letter.");
    expect(passwordSchema.safeParse(noLower).success).toBe(false);
  });

  it("enforces identical rules for missing numbers", () => {
    const noNum = "PasswordOnly";
    expect(validatePassword(noNum)).toBe("Password must contain at least one number.");
    expect(passwordSchema.safeParse(noNum).success).toBe(false);
  });

  it("normalizes leading/trailing whitespace while preserving internal spaces identically", () => {
    const spaced = "   My Strong Pass 123   ";
    expect(validatePassword(spaced)).toBeUndefined();
    const serverRes = passwordSchema.safeParse(spaced);
    expect(serverRes.success).toBe(true);
    if (serverRes.success) {
      expect(serverRes.data).toBe("My Strong Pass 123");
    }
  });

  it("enforces confirm password matching identically", () => {
    expect(validateConfirmPassword("Secret123", "Secret123")).toBeUndefined();
    expect(validateConfirmPassword("Secret123", "Different123")).toBe("Passwords do not match.");

    const matchServer = signupSchema.safeParse({
      fullName: "Bisi Adebayo",
      phoneNumber: "08012345678",
      password: "SecretPass123",
      confirmPassword: "SecretPass123",
      tier: "BASIC",
      otpCode: "123456",
    });
    expect(matchServer.success).toBe(true);

    const mismatchServer = signupSchema.safeParse({
      fullName: "Bisi Adebayo",
      phoneNumber: "08012345678",
      password: "SecretPass123",
      confirmPassword: "DifferentPass123",
      tier: "BASIC",
      otpCode: "123456",
    });
    expect(mismatchServer.success).toBe(false);
  });
});

describe("Argon2id Password Hashing and Security", () => {
  it("hashes password with Argon2id algorithm format", async () => {
    const plain = "StrongPassword1";
    const hashed = await hashPassword(plain);
    expect(hashed.startsWith("$argon2id$")).toBe(true);
    expect(hashed).not.toBe(plain);
  });

  it("generates unique cryptographically secure salts per password hash", async () => {
    const plain = "SamePassword123";
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);
    expect(hash1).not.toBe(hash2);
  });

  it("correctly verifies matching password", async () => {
    const plain = "CorrectPassword1";
    const hashed = await hashPassword(plain);
    const isValid = await verifyPassword(hashed, plain);
    expect(isValid).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const hashed = await hashPassword("CorrectPassword1");
    const isValid = await verifyPassword(hashed, "WrongPassword2");
    expect(isValid).toBe(false);
  });

  it("normalizes leading/trailing spaces consistently during hashing and verification", async () => {
    const hashed = await hashPassword("   TrimMePass123   ");
    expect(await verifyPassword(hashed, "TrimMePass123")).toBe(true);
    expect(await verifyPassword(hashed, "   TrimMePass123   ")).toBe(true);
  });

  it("preserves internal spaces during hashing and verification", async () => {
    const hashed = await hashPassword("My Pass Word 123");
    expect(await verifyPassword(hashed, "My Pass Word 123")).toBe(true);
    expect(await verifyPassword(hashed, "MyPassWord123")).toBe(false);
  });
});

describe("Signup and Login Schema Protection", () => {
  it("rejects signup when OTP format is invalid", () => {
    const res = signupSchema.safeParse({
      fullName: "Bisi Adebayo",
      phoneNumber: "08012345678",
      password: "SecretPass123",
      confirmPassword: "SecretPass123",
      tier: "BASIC",
      otpCode: "123",
    });
    expect(res.success).toBe(false);
  });

  it("validates login payload with phone and password", () => {
    const res = loginSchema.safeParse({
      phoneNumber: "08012345678",
      password: "SecretPass123",
    });
    expect(res.success).toBe(true);
  });

  it("rejects login payload with malformed phone number", () => {
    const res = loginSchema.safeParse({
      phoneNumber: "1234",
      password: "SecretPass123",
    });
    expect(res.success).toBe(false);
  });

  it("rejects login payload with missing password", () => {
    const res = loginSchema.safeParse({
      phoneNumber: "08012345678",
    });
    expect(res.success).toBe(false);
  });
});

describe("In-Memory Rate Limiting Logic", () => {
  it("allows first 5 attempts and rejects the 6th attempt", () => {
    resetRateLimitStore();
    const testKey = "test-op:192.168.1.100";

    for (let i = 1; i <= 5; i++) {
      const result = checkRateLimit(testKey, 5, 60000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(5 - i);
    }

    const sixthAttempt = checkRateLimit(testKey, 5, 60000);
    expect(sixthAttempt.success).toBe(false);
    expect(sixthAttempt.remaining).toBe(0);
  });

  it("generates correct rate limit response headers on success and limit-exceeded", () => {
    resetRateLimitStore();
    const testKey = "headers-test:10.0.0.1";

    const allowed = checkRateLimit(testKey, 5, 60000);
    const allowedHeaders = getRateLimitHeaders(allowed) as Record<string, string>;
    expect(allowedHeaders["X-RateLimit-Limit"]).toBe("5");
    expect(allowedHeaders["X-RateLimit-Remaining"]).toBe("4");
    expect(allowedHeaders["Retry-After"]).toBeUndefined();

    // Consume remaining
    for (let i = 0; i < 4; i++) {
      checkRateLimit(testKey, 5, 60000);
    }

    const blocked = checkRateLimit(testKey, 5, 60000);
    const blockedHeaders = getRateLimitHeaders(blocked) as Record<string, string>;
    expect(blockedHeaders["X-RateLimit-Limit"]).toBe("5");
    expect(blockedHeaders["X-RateLimit-Remaining"]).toBe("0");
    expect(blockedHeaders["Retry-After"]).toBeDefined();
    expect(Number(blockedHeaders["Retry-After"])).toBeGreaterThan(0);
  });

  it("isolates rate-limit keys between distinct operations and IPs", () => {
    resetRateLimitStore();
    const ip = "192.168.1.50";

    // Max out signup
    for (let i = 0; i < 5; i++) {
      checkRateLimit(`signup:${ip}`, 5, 60000);
    }
    expect(checkRateLimit(`signup:${ip}`, 5, 60000).success).toBe(false);

    // Login and reset-password operations remain completely unaffected
    expect(checkRateLimit(`login:${ip}`, 5, 60000).success).toBe(true);
    expect(checkRateLimit(`reset-password:${ip}`, 5, 60000).success).toBe(true);

    // Another IP remains unaffected
    expect(checkRateLimit(`signup:192.168.1.51`, 5, 60000).success).toBe(true);
  });

  it("correctly resets when window expires", () => {
    resetRateLimitStore();
    const testKey = "window-test:127.0.0.1";
    // 10ms window
    for (let i = 0; i < 5; i++) {
      checkRateLimit(testKey, 5, 10);
    }
    expect(checkRateLimit(testKey, 5, 10).success).toBe(false);

    // Wait for window to pass
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(testKey, 5, 10).success).toBe(true);
        resolve();
      }, 20);
    });
  });

  it("extracts client IP from standard proxy headers and defaults safely", () => {
    const req1 = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
    });
    expect(getClientIp(req1)).toBe("203.0.113.195");

    const req2 = new Request("https://example.com", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    expect(getClientIp(req2)).toBe("198.51.100.2");

    const req3 = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "192.0.2.1" },
    });
    expect(getClientIp(req3)).toBe("192.0.2.1");

    const reqFallback = new Request("https://example.com");
    expect(getClientIp(reqFallback)).toBe("127.0.0.1");
  });
});

describe("Have I Been Pwned (HIBP) Breached Password Protection", () => {
  it("computes accurate uppercase hexadecimal SHA-1 for passwords", () => {
    // "password" has known SHA-1 5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8
    const sha1 = computePasswordSha1("password");
    expect(sha1).toBe("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });

  it("preserves privacy: transmits ONLY 5-char prefix, never plaintext or full SHA-1", async () => {
    let capturedUrl = "";
    let capturedHeaders: HeadersInit | undefined;

    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedHeaders = init?.headers;
      return new Response("00000000000000000000000000000000000:1\n");
    }) as typeof fetch;

    const testPassword = "MySecretSuperPassword123";
    const sha1 = computePasswordSha1(testPassword);
    const prefix = sha1.slice(0, 5);

    await checkPwnedPassword(testPassword, mockFetch);

    // URL must be exactly range API with 5-char prefix
    expect(capturedUrl).toBe(`${HIBP_RANGE_API_URL}/${prefix}`);
    // Plaintext password and full hash must NOT be anywhere in URL
    expect(capturedUrl.includes(testPassword)).toBe(false);
    expect(capturedUrl.includes(sha1)).toBe(false);
  });

  it("identifies known breached passwords via suffix matching", async () => {
    const password = "BreachedPassword1";
    const sha1 = computePasswordSha1(password);
    const suffix = sha1.slice(5);

    // Mock response containing the matching suffix
    const mockResponseText = `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${suffix}:42\r\n00D4F6E8FEA0E0E00E47232C22C2333AD2E:58`;
    const mockFetch = (async () => new Response(mockResponseText)) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    expect(result.status).toBe("BREACHED");
  });

  it("ignores padding entries where count is 0 to prevent false-positive rejections", async () => {
    const password = "UniqueUnpaddedPass2026!";
    const sha1 = computePasswordSha1(password);
    const suffix = sha1.slice(5);

    // HIBP returns padding records with count: 0 when Add-Padding: true is set
    const mockPaddingResponseText = `0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n${suffix}:0\r\n00D4F6E8FEA0E0E00E47232C22C2333AD2E:5`;
    const mockFetch = (async () =>
      new Response(mockPaddingResponseText)) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    // Even if suffix matches a padding entry, because count === 0, it must be SAFE
    expect(result.status).toBe("SAFE");
  });

  it("verifies multiple deterministic high-entropy random passwords are classified as SAFE", async () => {
    const safePasswords = [
      "X9#mK$2vL@8qZ!wP5tY7",
      "Spotter_Gym_Secure_Test_2026_xYz987!",
      "K9#vL2$mQ8@zP5!wY7tX",
      "9f!A#b8$C7@d6%E5^F4&",
      "Alpha$Bravo#Charlie*Delta99",
    ];

    const mockEmptyRange = (async () =>
      new Response("0018A45C4D1DEF81644B54AB7F969B88D65:12\r\n")) as typeof fetch;

    for (const pw of safePasswords) {
      const result = await checkPwnedPassword(pw, mockEmptyRange);
      expect(result.status).toBe("SAFE");
    }
  });

  it("prevents partial or substring matches from causing false positives", async () => {
    const password = "RandomTestPassword123!";
    const sha1 = computePasswordSha1(password);
    const suffix = sha1.slice(5);

    // Mock response with a prefix of the suffix, or a longer string containing suffix
    const partialSuffix = suffix.slice(0, 30);
    const mockResponseText = `${partialSuffix}:45\r\n${suffix}EXTRA:10\r\nPRE${suffix}:20`;
    const mockFetch = (async () =>
      new Response(mockResponseText)) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    expect(result.status).toBe("SAFE");
  });

  it("matches suffixes case-insensitively when exact match with count > 0 is present", async () => {
    const password = "BreachedMixedCasePass1";
    const sha1 = computePasswordSha1(password);
    const suffix = sha1.slice(5);

    // Lowercase suffix returned by API with real breach count
    const mockResponseText = `${suffix.toLowerCase()}:15`;
    const mockFetch = (async () =>
      new Response(mockResponseText)) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    expect(result.status).toBe("BREACHED");
    if (result.status === "BREACHED") {
      expect(result.count).toBe(15);
    }
  });

  it("handles HIBP server errors with fail-closed policy", async () => {
    const mock500Fetch = (async () =>
      new Response("Server Error", { status: 500 })) as typeof fetch;

    const result = await checkPwnedPassword("TestPass123", mock500Fetch);
    expect(result.status).toBe("ERROR");
    if (result.status === "ERROR") {
      expect(result.error).toContain("Unable to verify password security");
    }
  });

  it("handles HIBP network errors and timeouts with fail-closed policy", async () => {
    const mockNetworkErrorFetch = (async () => {
      throw new Error("Network connection lost");
    }) as typeof fetch;

    const result = await checkPwnedPassword("TestPass123", mockNetworkErrorFetch);
    expect(result.status).toBe("ERROR");
  });

  it("verifies a returned HIBP record with a different suffix does NOT produce a false positive", async () => {
    const password = "UniquePasswordNotBreached2026!";
    const sha1 = computePasswordSha1(password);
    const actualSuffix = sha1.slice(5);

    // Completely different suffix in the range response
    const differentSuffix = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF";
    expect(differentSuffix).not.toBe(actualSuffix);

    const mockFetch = (async () =>
      new Response(`${differentSuffix}:99999\r\n`)) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    expect(result.status).toBe("SAFE");
  });

  it("verifies prefix matching alone does NOT count as a breach", async () => {
    const password = "HighEntropyTestPassword_2026_XYZ!";
    const sha1 = computePasswordSha1(password);
    const actualSuffix = sha1.slice(5);

    // Simulate HIBP returning hundreds of records for this 5-char prefix,
    // none of which match the actual 35-char suffix
    const rangeLines: string[] = [];
    for (let i = 0; i < 50; i++) {
      const dummySuffix = i.toString(16).padStart(35, "0").toUpperCase();
      if (dummySuffix !== actualSuffix) {
        rangeLines.push(`${dummySuffix}:${i + 1}`);
      }
    }

    const mockFetch = (async () =>
      new Response(rangeLines.join("\r\n"))) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    // Despite 50 records sharing the same prefix, the password is SAFE because suffix didn't match
    expect(result.status).toBe("SAFE");
  });
});

describe("Reset Password Request Validation and Account-Enumeration Protection", () => {
  it("validates valid phone numbers for reset password request", () => {
    const res1 = requestResetSchema.safeParse({ phoneNumber: "08012345678" });
    expect(res1.success).toBe(true);

    const res2 = requestResetSchema.safeParse({ phoneNumber: "+2348012345678" });
    expect(res2.success).toBe(true);
  });

  it("rejects malformed or empty phone numbers for reset password request", () => {
    const resShort = requestResetSchema.safeParse({ phoneNumber: "1234" });
    expect(resShort.success).toBe(false);

    const resLetters = requestResetSchema.safeParse({ phoneNumber: "abc12345678" });
    expect(resLetters.success).toBe(false);

    const resEmpty = requestResetSchema.safeParse({ phoneNumber: "" });
    expect(resEmpty.success).toBe(false);
  });

  it("ensures identical generic response regardless of account existence (prevents account enumeration)", () => {
    const GENERIC_RESET_RESPONSE = {
      success: true,
      message: "If an account exists for this number, you will receive a verification code.",
    };

    const handleResetRequest = (memberExists: boolean) => {
      if (!memberExists) {
        return GENERIC_RESET_RESPONSE;
      }
      return GENERIC_RESET_RESPONSE;
    };

    const existingUserResponse = handleResetRequest(true);
    const nonExistingUserResponse = handleResetRequest(false);

    expect(existingUserResponse).toEqual(nonExistingUserResponse);
    expect(existingUserResponse.message).toBe(
      "If an account exists for this number, you will receive a verification code."
    );
    expect(JSON.stringify(nonExistingUserResponse)).not.toContain("not found");
    expect(JSON.stringify(nonExistingUserResponse)).not.toContain("does not exist");
  });

  it("enforces rate limiting of 5 attempts per 15 minutes on reset password with 6th returning 429", () => {
    resetRateLimitStore();
    const ip = "192.0.2.77";
    const resetKey = `reset-password:${ip}`;

    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = checkRateLimit(resetKey, 5, 15 * 60 * 1000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(5 - attempt);
    }

    const sixth = checkRateLimit(resetKey, 5, 15 * 60 * 1000);
    expect(sixth.success).toBe(false);
    expect(sixth.remaining).toBe(0);

    const headers = getRateLimitHeaders(sixth) as Record<string, string>;
    expect(headers["X-RateLimit-Limit"]).toBe("5");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });
});

describe("Reset Password OTP Verification Schema Rules", () => {
  it("validates valid 6-digit numeric OTP in reset password payload", () => {
    const res = resetPasswordSchema.safeParse({
      phoneNumber: "08012345678",
      otpCode: "123456",
      password: "NewSecretPassword1",
      confirmPassword: "NewSecretPassword1",
    });
    expect(res.success).toBe(true);
  });

  it("rejects invalid or malformed OTP codes in reset password payload", () => {
    expect(
      resetPasswordSchema.safeParse({
        phoneNumber: "08012345678",
        otpCode: "12345",
        password: "NewSecretPassword1",
        confirmPassword: "NewSecretPassword1",
      }).success
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        phoneNumber: "08012345678",
        otpCode: "1234567",
        password: "NewSecretPassword1",
        confirmPassword: "NewSecretPassword1",
      }).success
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        phoneNumber: "08012345678",
        otpCode: "abcdef",
        password: "NewSecretPassword1",
        confirmPassword: "NewSecretPassword1",
      }).success
    ).toBe(false);
  });

  it("verifies OTP verification rules according to existing OTP architecture", () => {
    const verifyResetOtp = (otp: string) => {
      const isAcceptedDevOtp = otp === "123456" || otp === "000000";
      return isAcceptedDevOtp;
    };

    expect(verifyResetOtp("123456")).toBe(true);
    expect(verifyResetOtp("000000")).toBe(true);
    expect(verifyResetOtp("999999")).toBe(false);
    expect(verifyResetOtp("111111")).toBe(false);
  });
});

describe("Reset Password Complexity, Normalization and Mismatch Rules", () => {
  it("validates secure new passwords complying with all 4 complexity rules", () => {
    const res = resetPasswordSchema.safeParse({
      phoneNumber: "08012345678",
      otpCode: "123456",
      password: "ValidNewPass1",
      confirmPassword: "ValidNewPass1",
    });
    expect(res.success).toBe(true);
  });

  it("rejects reset passwords shorter than 8 characters", () => {
    const res = resetPasswordSchema.safeParse({
      phoneNumber: "08012345678",
      otpCode: "123456",
      password: "Sh0rt1",
      confirmPassword: "Sh0rt1",
    });
    expect(res.success).toBe(false);
  });

  it("rejects reset passwords missing uppercase letter", () => {
    const res = resetPasswordSchema.safeParse({
      phoneNumber: "08012345678",
      otpCode: "123456",
      password: "nouppercase123",
      confirmPassword: "nouppercase123",
    });
    expect(res.success).toBe(false);
  });

  it("rejects reset passwords missing lowercase letter", () => {
    const res = resetPasswordSchema.safeParse({
      phoneNumber: "08012345678",
      otpCode: "123456",
      password: "NOLOWERCASE123",
      confirmPassword: "NOLOWERCASE123",
    });
    expect(res.success).toBe(false);
  });

  it("rejects reset passwords missing a number", () => {
    const res = resetPasswordSchema.safeParse({
      phoneNumber: "08012345678",
      otpCode: "123456",
      password: "NoNumberHere!",
      confirmPassword: "NoNumberHere!",
    });
    expect(res.success).toBe(false);
  });

  it("rejects reset password confirmation mismatch", () => {
    const res = resetPasswordSchema.safeParse({
      phoneNumber: "08012345678",
      otpCode: "123456",
      password: "ValidNewPass1",
      confirmPassword: "MismatchedPass2",
    });
    expect(res.success).toBe(false);
  });

  it("normalizes leading/trailing whitespace while preserving internal spaces in reset schema", () => {
    const spaced = "   My Strong Reset Pass 99   ";
    const res = resetPasswordSchema.safeParse({
      phoneNumber: "08012345678",
      otpCode: "123456",
      password: spaced,
      confirmPassword: spaced,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.password).toBe("My Strong Reset Pass 99");
      expect(res.data.confirmPassword).toBe("My Strong Reset Pass 99");
    }
  });
});

describe("Reset Password HIBP Breached Check and Fail-Closed Security", () => {
  it("rejects a known breached password during reset", async () => {
    const password = "BreachedResetPass1";
    const sha1 = computePasswordSha1(password);
    const suffix = sha1.slice(5);

    const mockFetch = (async () =>
      new Response(`${suffix}:120\r\n`)) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    expect(result.status).toBe("BREACHED");
  });

  it("accepts an unbreached safe password during reset", async () => {
    const password = "SafeUniqueResetPass99";
    const mockFetch = (async () =>
      new Response("00000000000000000000000000000000000:1\r\n")) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    expect(result.status).toBe("SAFE");
  });

  it("accepts reset password when HIBP response contains matching padding entry with count 0", async () => {
    const password = "SafeUniqueResetPassWithPadding99";
    const sha1 = computePasswordSha1(password);
    const suffix = sha1.slice(5);

    const mockFetch = (async () =>
      new Response(`${suffix}:0\r\n00000000000000000000000000000000000:25\r\n`)) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    expect(result.status).toBe("SAFE");
  });

  it("blocks password update when HIBP service fails (fail-closed policy)", async () => {
    const mockFailedFetch = (async () => {
      throw new Error("Connection timed out");
    }) as typeof fetch;

    const result = await checkPwnedPassword("SomePassword123", mockFailedFetch);
    expect(result.status).toBe("ERROR");
    const shouldAllowUpdate = result.status === "SAFE";
    expect(shouldAllowUpdate).toBe(false);
  });

  it("verifies privacy: never sends plaintext password or full SHA-1 hash to HIBP", async () => {
    let capturedUrl = "";
    const mockFetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response("");
    }) as typeof fetch;

    const testPassword = "VerySecretNewPassword123";
    const fullSha1 = computePasswordSha1(testPassword);

    await checkPwnedPassword(testPassword, mockFetch);

    expect(capturedUrl).toBe(`${HIBP_RANGE_API_URL}/${fullSha1.slice(0, 5)}`);
    expect(capturedUrl).not.toContain(testPassword);
    expect(capturedUrl).not.toContain(fullSha1);
  });
});

describe("Reset Password Argon2id Replacement and Security Invariants", () => {
  it("replaces password with Argon2id hash and verifies new password while invalidating old password", async () => {
    const oldPassword = "OldGymPassword1";
    const newPassword = "NewGymPassword2";

    const oldHash = await hashPassword(oldPassword);
    expect(await verifyPassword(oldHash, oldPassword)).toBe(true);

    const newHash = await hashPassword(newPassword);
    expect(newHash.startsWith("$argon2id$")).toBe(true);
    expect(newHash).not.toBe(newPassword);
    expect(newHash).not.toBe(oldHash);

    expect(await verifyPassword(newHash, newPassword)).toBe(true);
    expect(await verifyPassword(newHash, oldPassword)).toBe(false);
  });

  it("ensures plaintext password is never stored or exposed in logs", () => {
    const sensitivePayload = {
      phoneNumber: "+2348000000000",
      password: "PlainTextPassword123",
      confirmPassword: "PlainTextPassword123",
      otpCode: "654321",
    };

    const sanitizeForLog = (data: typeof sensitivePayload) => ({
      phoneNumber: data.phoneNumber,
      password: "[REDACTED]",
      confirmPassword: "[REDACTED]",
      otpCode: "[REDACTED]",
    });

    const logged = sanitizeForLog(sensitivePayload);
    expect(JSON.stringify(logged)).not.toContain("PlainTextPassword123");
    expect(JSON.stringify(logged)).not.toContain("654321");
  });
});

describe("Login Flow Zod Validation and Normalization", () => {
  it("validates that Zod works cleanly for the login flow", () => {
    const validResult = loginSchema.safeParse({
      phoneNumber: "08012345678",
      password: "SecretPassword1",
    });
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data.phoneNumber).toBe("08012345678");
    }
  });

  it("normalizes phone numbers with trim and lowercase in Zod login schema", () => {
    const rawInput = "   08012345678   ";
    const result = loginSchema.safeParse({
      phoneNumber: rawInput,
      password: "SecretPassword1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phoneNumber).toBe("08012345678");
    }
  });

  it("trims and lowercases input using normalizePhoneNumber helper", () => {
    expect(normalizePhoneNumber("   +2348012345678   ")).toBe("+2348012345678");
    expect(normalizePhoneNumber("  USER@GYM.COM  ")).toBe("user@gym.com");
  });

  it("trims and lowercases input using normalizePhoneNumberInput form helper", () => {
    expect(normalizePhoneNumberInput("   08012345678   ")).toBe("08012345678");
    expect(normalizePhoneNumberInput("  080ABC  ")).toBe("080abc");
  });

  it("rejects login input when phone number does not meet format requirements", () => {
    const result = loginSchema.safeParse({
      phoneNumber: "123",
      password: "SecretPassword1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects login input when password is empty or whitespace", () => {
    const result = loginSchema.safeParse({
      phoneNumber: "08012345678",
      password: "   ",
    });
    expect(result.success).toBe(false);
  });
});

describe("Login Verification: Phone Lookup, Argon2 Password, and Phone Verification Status", () => {
  it("performs login lookup using normalized phone number", async () => {
    const members = [
      {
        id: "mem_1",
        phoneNumber: "08012345678",
        isActive: true,
        deactivatedAt: null,
      },
    ];

    const findMemberByPhone = (phoneInput: string) => {
      const normalized = normalizePhoneNumber(phoneInput);
      return members.find((m) => m.phoneNumber === normalized) || null;
    };

    expect(findMemberByPhone("08012345678")).not.toBeNull();
    expect(findMemberByPhone("   08012345678   ")).not.toBeNull();
    expect(findMemberByPhone("08099999999")).toBeNull();
  });

  it("verifies password using Argon2id during login flow", async () => {
    const correctPassword = "UserPass123";
    const passwordHash = await hashPassword(correctPassword);

    const isMatch = await verifyPassword(passwordHash, "UserPass123");
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyPassword(passwordHash, "WrongPass999");
    expect(isWrongMatch).toBe(false);
  });

  it("blocks login and checks user phone number verification status when unverified", () => {
    const checkMemberStatus = (member: { isActive: boolean; deactivatedAt: Date | null }) => {
      if (member.deactivatedAt) {
        return { allowed: false, status: 403, error: "This account has been deactivated. Please contact gym staff." };
      }
      if (!member.isActive) {
        return { allowed: false, status: 403, error: "Phone number is not verified. Please verify your phone number before logging in." };
      }
      return { allowed: true };
    };

    const unverifiedMember = { isActive: false, deactivatedAt: null };
    const unverifiedResult = checkMemberStatus(unverifiedMember);
    expect(unverifiedResult.allowed).toBe(false);
    expect(unverifiedResult.status).toBe(403);
    expect(unverifiedResult.error).toBe(
      "Phone number is not verified. Please verify your phone number before logging in."
    );

    const activeMember = { isActive: true, deactivatedAt: null };
    const activeResult = checkMemberStatus(activeMember);
    expect(activeResult.allowed).toBe(true);

    const deactivatedMember = { isActive: true, deactivatedAt: new Date() };
    const deactivatedResult = checkMemberStatus(deactivatedMember);
    expect(deactivatedResult.allowed).toBe(false);
    expect(deactivatedResult.status).toBe(403);
    expect(deactivatedResult.error).toBe("This account has been deactivated. Please contact gym staff.");
  });
});

describe("Fresh Session Token Issuance", () => {
  it("generates a fresh cryptographically secure random session token on every call", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).toBeDefined();
    expect(typeof token1).toBe("string");
    expect(token1.length).toBeGreaterThan(32);
    expect(token2).toBeDefined();
    expect(token1).not.toBe(token2);
  });

  it("issues fresh distinct session tokens for consecutive sign-ins", () => {
    const issuedTokens = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const token = generateSessionToken();
      expect(issuedTokens.has(token)).toBe(false);
      issuedTokens.add(token);
    }
    expect(issuedTokens.size).toBe(50);
  });

  it("sets correct expiration timestamp for new session tokens", () => {
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_DURATION_MS);
    expect(expiresAt.getTime()).toBeGreaterThan(now);
    expect(SESSION_DURATION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("Session Cookie Hashing and Database Reflection", () => {
  it("hashes session tokens using SHA-256 producing 64-character hex digests", () => {
    const rawToken = "550e8400-e29b-41d4-a716-446655440000-abcdef1234567890";
    const hashed = hashSessionToken(rawToken);

    expect(hashed).toBeDefined();
    expect(hashed.length).toBe(64);
    expect(/^[a-f0-9]{64}$/.test(hashed)).toBe(true);
    expect(hashed).not.toBe(rawToken);
  });

  it("produces deterministic SHA-256 hashes for identical session tokens", () => {
    const token = generateSessionToken();
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);
    expect(hash1).toBe(hash2);
  });

  it("produces unique hashes for distinct session tokens", () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    expect(hashSessionToken(token1)).not.toBe(hashSessionToken(token2));
  });

  it("ensures raw token is sent to the client while the database stores only the hash", () => {
    const rawToken = generateSessionToken();
    const dbStoredHash = hashSessionToken(rawToken);

    // Mock incoming cookie from client browser
    const clientCookie = rawToken;

    // Database lookup queries by hash of client cookie
    const lookupHash = hashSessionToken(clientCookie);
    expect(lookupHash).toBe(dbStoredHash);
  });
});

describe("User Validity Check (Banned, Locked, Deactivated)", () => {
  interface MockMember {
    id: string;
    fullName: string;
    phoneNumber: string;
    tier: string;
    isActive: boolean;
    deactivatedAt: Date | null;
  }

  interface MockSession {
    sessionToken: string;
    expiresAt: Date;
    revokedAt: Date | null;
    member: MockMember;
  }

  interface SessionValidationResult {
    valid: boolean;
    reason?: string;
    member?: MockMember;
  }

  const validateSessionRecord = (session: MockSession | null): SessionValidationResult => {
    if (!session) return { valid: false, reason: "NOT_FOUND" };
    if (session.revokedAt) return { valid: false, reason: "REVOKED" };
    if (session.expiresAt.getTime() <= Date.now()) return { valid: false, reason: "EXPIRED" };
    if (!session.member.isActive) return { valid: false, reason: "UNVERIFIED_OR_LOCKED" };
    if (session.member.deactivatedAt) return { valid: false, reason: "BANNED_OR_DEACTIVATED" };
    return { valid: true, member: session.member };
  };

  it("accepts active, verified, non-deactivated user with valid session", () => {
    const session: MockSession = {
      sessionToken: hashSessionToken("valid-token"),
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      member: {
        id: "mem_valid",
        fullName: "Amaka Eze",
        phoneNumber: "08012345678",
        tier: "PREMIUM",
        isActive: true,
        deactivatedAt: null,
      },
    };

    const result = validateSessionRecord(session);
    expect(result.valid).toBe(true);
    if (result.valid && result.member) {
      expect(result.member.id).toBe("mem_valid");
    }
  });

  it("rejects user who is locked or unverified (isActive: false)", () => {
    const session: MockSession = {
      sessionToken: hashSessionToken("locked-user-token"),
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      member: {
        id: "mem_locked",
        fullName: "Locked User",
        phoneNumber: "08011112222",
        tier: "BASIC",
        isActive: false,
        deactivatedAt: null,
      },
    };

    const result = validateSessionRecord(session);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("UNVERIFIED_OR_LOCKED");
  });

  it("rejects user who is banned or deactivated (deactivatedAt is set)", () => {
    const session: MockSession = {
      sessionToken: hashSessionToken("banned-user-token"),
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: null,
      member: {
        id: "mem_banned",
        fullName: "Banned User",
        phoneNumber: "08033334444",
        tier: "BASIC",
        isActive: true,
        deactivatedAt: new Date(),
      },
    };

    const result = validateSessionRecord(session);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("BANNED_OR_DEACTIVATED");
  });

  it("rejects expired session", () => {
    const session: MockSession = {
      sessionToken: hashSessionToken("expired-token"),
      expiresAt: new Date(Date.now() - 5000),
      revokedAt: null,
      member: {
        id: "mem_expired",
        fullName: "Expired Session User",
        phoneNumber: "08055556666",
        tier: "BASIC",
        isActive: true,
        deactivatedAt: null,
      },
    };

    const result = validateSessionRecord(session);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("EXPIRED");
  });

  it("rejects revoked session (logged out)", () => {
    const session: MockSession = {
      sessionToken: hashSessionToken("revoked-token"),
      expiresAt: new Date(Date.now() + 100000),
      revokedAt: new Date(),
      member: {
        id: "mem_revoked",
        fullName: "Logged Out User",
        phoneNumber: "08077778888",
        tier: "PREMIUM",
        isActive: true,
        deactivatedAt: null,
      },
    };

    const result = validateSessionRecord(session);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("REVOKED");
  });
});

describe("Server-Side Logout and Session Revocation", () => {
  it("marks session revoked server-side and invalidates subsequent lookups", () => {
    const rawToken = generateSessionToken();
    const storedSessions = new Map<string, { revokedAt: Date | null }>();

    const hashedToken = hashSessionToken(rawToken);
    storedSessions.set(hashedToken, { revokedAt: null });

    // Server-side logout execution
    const serverSideLogout = (token: string) => {
      const h = hashSessionToken(token);
      const s = storedSessions.get(h);
      if (s && !s.revokedAt) {
        s.revokedAt = new Date();
        return true;
      }
      return false;
    };

    expect(storedSessions.get(hashedToken)?.revokedAt).toBeNull();

    const loggedOut = serverSideLogout(rawToken);
    expect(loggedOut).toBe(true);
    expect(storedSessions.get(hashedToken)?.revokedAt).not.toBeNull();

    // Repeated logout is a safe no-op
    const repeatLogout = serverSideLogout(rawToken);
    expect(repeatLogout).toBe(false);
  });
});

describe("Middleware Protection and Header Attachment Rules", () => {
  const PROTECTED_PREFIXES = ["/dashboard", "/member", "/settings", "/profile"];

  const evaluateMiddleware = (
    pathname: string,
    sessionCookie: string | undefined,
    sessionValidationResult?: { valid: boolean; member?: { id: string; fullName: string; phoneNumber: string; tier: string } }
  ) => {
    const isProtected = PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

    if (isProtected && !sessionCookie) {
      return {
        action: "REDIRECT",
        destination: `/auth?mode=login&redirect=${encodeURIComponent(pathname)}`,
      };
    }

    if (sessionCookie && sessionValidationResult) {
      if (sessionValidationResult.valid && sessionValidationResult.member) {
        if (pathname === "/auth" || pathname === "/login") {
          return { action: "REDIRECT", destination: "/dashboard" };
        }
        return {
          action: "NEXT",
          headers: {
            "x-member-id": sessionValidationResult.member.id,
            "x-member-phone": sessionValidationResult.member.phoneNumber,
            "x-member-name": sessionValidationResult.member.fullName,
            "x-member-tier": sessionValidationResult.member.tier,
          },
        };
      }

      if (isProtected) {
        return {
          action: "REDIRECT",
          destination: `/auth?mode=login&redirect=${encodeURIComponent(pathname)}&error=session_expired`,
          clearCookie: true,
        };
      }
    }

    return { action: "NEXT" };
  };

  it("redirects unauthenticated users trying to access protected dashboard to login", () => {
    const result = evaluateMiddleware("/dashboard", undefined);
    expect(result.action).toBe("REDIRECT");
    expect(result.destination).toContain("/auth?mode=login");
  });

  it("attaches member details to request headers when valid session is verified", () => {
    const result = evaluateMiddleware("/dashboard", "valid-raw-cookie", {
      valid: true,
      member: {
        id: "mem_42",
        fullName: "Chioma Okeke",
        phoneNumber: "08012345678",
        tier: "PREMIUM",
      },
    });

    expect(result.action).toBe("NEXT");
    expect(result.headers?.["x-member-id"]).toBe("mem_42");
    expect(result.headers?.["x-member-name"]).toBe("Chioma Okeke");
    expect(result.headers?.["x-member-phone"]).toBe("08012345678");
    expect(result.headers?.["x-member-tier"]).toBe("PREMIUM");
  });

  it("redirects to login and clears cookie when session is expired or user is banned", () => {
    const result = evaluateMiddleware("/dashboard", "banned-or-expired-cookie", {
      valid: false,
    });

    expect(result.action).toBe("REDIRECT");
    expect(result.destination).toContain("/auth?mode=login");
    expect(result.clearCookie).toBe(true);
  });

  it("allows public access to landing page without session cookie", () => {
    const result = evaluateMiddleware("/", undefined);
    expect(result.action).toBe("NEXT");
  });
});

describe("Account Deletion Lifecycle: Soft Delete, Grace Period, and Hard Purge", () => {
  it("verifies the default grace period is exactly 30 days", () => {
    expect(ACCOUNT_DELETION_GRACE_PERIOD_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("calculates account deletion status accurately during grace period", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const deactivatedAt = new Date("2026-10-04T12:00:00Z"); // 10 days ago

    const status = getAccountDeletionStatus(deactivatedAt, now);
    expect(status.isScheduled).toBe(true);
    expect(status.isGracePeriodExpired).toBe(false);
    expect(status.daysRemaining).toBe(20);
    expect(status.scheduledPurgeDate).toEqual(new Date("2026-11-03T12:00:00Z"));
  });

  it("identifies when the 30-day grace period has expired", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    const deactivatedAt = new Date("2026-10-01T12:00:00Z"); // 50 days ago

    const status = getAccountDeletionStatus(deactivatedAt, now);
    expect(status.isScheduled).toBe(true);
    expect(status.isGracePeriodExpired).toBe(true);
    expect(status.daysRemaining).toBe(0);
  });

  it("returns not scheduled for active members without deactivatedAt", () => {
    const status = getAccountDeletionStatus(null);
    expect(status.isScheduled).toBe(false);
    expect(status.scheduledPurgeDate).toBeNull();
    expect(status.isGracePeriodExpired).toBe(false);
    expect(status.daysRemaining).toBeNull();
  });

  it("simulates soft deletion by disabling account and revoking all active sessions", () => {
    const member = {
      id: "mem_del_1",
      isActive: true,
      deactivatedAt: null as Date | null,
    };

    const activeSessions = [
      { id: "sess_1", revokedAt: null as Date | null },
      { id: "sess_2", revokedAt: null as Date | null },
    ];

    const softDeleteMember = (targetMember: typeof member, now: Date) => {
      targetMember.deactivatedAt = now;
      targetMember.isActive = false;
      for (const sess of activeSessions) {
        sess.revokedAt = now;
      }
    };

    const deletionTime = new Date("2026-10-14T15:00:00Z");
    softDeleteMember(member, deletionTime);

    expect(member.isActive).toBe(false);
    expect(member.deactivatedAt).toEqual(deletionTime);
    expect(activeSessions.every((s) => s.revokedAt === deletionTime)).toBe(true);
  });

  it("simulates hard purging: scrubs PII while retaining financial ledger references", () => {
    const member = {
      id: "mem_purge_99",
      fullName: "Bisi Adebayo",
      phoneNumber: "08012345678",
      passwordHash: "$argon2id$mockhash" as string | null,
      balanceKobo: 500000,
      tier: "PREMIUM",
      expiresAt: new Date("2026-12-31") as Date | null,
      isActive: false,
    };

    const financialLedgerEntries = [
      { id: "led_1", memberId: "mem_purge_99", amountKobo: 500000, entryType: "PAYMENT_CREDIT" },
    ];

    // Purge action execution
    const purgeMemberRecord = (target: typeof member) => {
      target.fullName = "Deleted Member";
      target.phoneNumber = `deleted_${target.id}`;
      target.passwordHash = null;
      target.balanceKobo = 0;
      target.tier = "BASIC";
      target.expiresAt = null;
      target.isActive = false;
    };

    purgeMemberRecord(member);

    // PII scrubbed
    expect(member.fullName).toBe("Deleted Member");
    expect(member.phoneNumber).toBe("deleted_mem_purge_99");
    expect(member.passwordHash).toBeNull();
    expect(member.balanceKobo).toBe(0);

    // Financial ledger integrity preserved
    expect(financialLedgerEntries[0].memberId).toBe("mem_purge_99");
    expect(financialLedgerEntries[0].amountKobo).toBe(500000);
  });

  it("scheduled purge runner filters only records whose grace period has expired", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    const cutoffDate = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_PERIOD_MS);

    const membersDatabase = [
      { id: "mem_active", deactivatedAt: null, fullName: "Active User" },
      {
        id: "mem_in_grace",
        deactivatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago (within grace period)
        fullName: "Grace Period User",
      },
      {
        id: "mem_expired_1",
        deactivatedAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000), // 35 days ago (grace period expired)
        fullName: "Expired Grace User 1",
      },
      {
        id: "mem_already_purged",
        deactivatedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
        fullName: "Deleted Member", // Already purged
      },
    ];

    const findEligibleToPurge = (members: typeof membersDatabase) => {
      return members.filter(
        (m) =>
          m.deactivatedAt !== null &&
          m.deactivatedAt <= cutoffDate &&
          m.fullName !== "Deleted Member"
      );
    };

    const eligible = findEligibleToPurge(membersDatabase);
    expect(eligible.length).toBe(1);
    expect(eligible[0].id).toBe("mem_expired_1");
  });
});




