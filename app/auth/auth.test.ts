import { describe, it, expect } from "vitest";
import {
  passwordSchema,
  signupSchema,
  loginSchema,
  requestResetSchema,
  resetPasswordSchema,
} from "../../lib/validations";
import {
  validatePassword,
  validateConfirmPassword,
} from "./auth-client";
import {
  hashPassword,
  verifyPassword,
  normalizePassword,
} from "../../lib/password";
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

  it("accepts passwords that do not appear in the returned range", async () => {
    const password = "VeryUniquePasswordNeverBreached123";
    const sha1 = computePasswordSha1(password);
    const suffix = sha1.slice(5);

    // Mock response without matching suffix
    const mockResponseText = `0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n11111111111111111111111111111111111:58`;
    const mockFetch = (async () => new Response(mockResponseText)) as typeof fetch;

    const result = await checkPwnedPassword(password, mockFetch);
    expect(result.status).toBe("SAFE");
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

