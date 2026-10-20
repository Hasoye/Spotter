import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  staffLoginSchema,
  generateMemberNumberSchema,
} from "../../lib/validations";
import {
  hashSessionToken,
  generateSessionToken,
  STAFF_COOKIE_NAME,
  STAFF_SESSION_DURATION_MS,
} from "../../lib/staff-session";
import {
  checkRateLimit,
  resetRateLimitStore,
} from "../../lib/rate-limit";
import { hashPassword } from "../../lib/password";
import { generateServerMemberNumber } from "../../lib/member-number";

// Mock Prisma
vi.mock("../../lib/prisma", () => ({
  prisma: {
    staff: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    staffSession: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    member: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma";
import {
  issueStaffSession,
  getValidStaffSession,
  revokeStaffSession,
} from "../../lib/staff-session";
import {
  requireStaffRole,
  requireStaffRoleFromRequest,
  RECEPTIONIST_ROLES,
  StaffRole,
} from "../../lib/rbac";
import { POST as staffLoginRoute } from "../api/auth/staff/login/route";
import { POST as staffLogoutRoute } from "../api/auth/staff/logout/route";
import { GET as staffVerifySessionRoute } from "../api/auth/staff/verify-session/route";
import { POST as generateMemberNumberRoute } from "../api/staff/generate-member-number/route";

describe("Staff Input Validation (staffLoginSchema)", () => {
  it("validates valid email identifier and password", () => {
    const valid = staffLoginSchema.safeParse({
      identifier: "receptionist@spottergym.com",
      password: "SecurePassword123!",
    });
    expect(valid.success).toBe(true);
  });

  it("validates valid phone number identifier and password", () => {
    const valid = staffLoginSchema.safeParse({
      identifier: "08012345678",
      password: "ValidPassword1",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects identifier shorter than 3 characters", () => {
    const invalid = staffLoginSchema.safeParse({
      identifier: "ab",
      password: "Password123",
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects empty password", () => {
    const invalid = staffLoginSchema.safeParse({
      identifier: "staff@spottergym.com",
      password: "",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Member Number Schema Validation (generateMemberNumberSchema)", () => {
  it("validates valid member input", () => {
    const valid = generateMemberNumberSchema.safeParse({
      fullName: "Adeola Adeleke",
      phoneNumber: "08012345678",
      tier: "PREMIUM",
    });
    expect(valid.success).toBe(true);
  });

  it("defaults tier to BASIC if omitted", () => {
    const valid = generateMemberNumberSchema.safeParse({
      fullName: "Bisi Akande",
      phoneNumber: "+2348012345678",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.tier).toBe("BASIC");
    }
  });

  it("rejects name shorter than 2 characters", () => {
    const invalid = generateMemberNumberSchema.safeParse({
      fullName: "A",
      phoneNumber: "08012345678",
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects invalid phone numbers", () => {
    const invalid = generateMemberNumberSchema.safeParse({
      fullName: "Valid Name",
      phoneNumber: "1234",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Staff Session Management (lib/staff-session.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hashes session tokens using SHA-256 for secure storage", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  it("issues a fresh staff session with 24-hour expiration", async () => {
    const mockStaffId = "staff_desk_123";
    const beforeNow = Date.now();

    (prisma.staffSession.create as any).mockImplementation(({ data }: any) => {
      return Promise.resolve({
        id: "session_abc",
        staffId: data.staffId,
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
    });

    const issued = await issueStaffSession(mockStaffId, {
      ipAddress: "127.0.0.1",
      userAgent: "Vitest Agent",
    });

    expect(issued.staffId).toBe(mockStaffId);
    expect(issued.rawToken).toBeDefined();
    expect(issued.sessionToken).toBe(hashSessionToken(issued.rawToken));
    expect(issued.expiresAt.getTime()).toBeGreaterThanOrEqual(
      beforeNow + STAFF_SESSION_DURATION_MS - 5000
    );
  });

  it("verifies and returns an active, unrevoked, unexpired staff session", async () => {
    const rawToken = generateSessionToken();
    const hashedToken = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "session_valid",
      sessionToken: hashedToken,
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
      staff: {
        id: "staff_123",
        fullName: "Alex FrontDesk",
        email: "alex@spottergym.com",
        role: "FRONT_DESK",
        isActive: true,
      },
    });

    const session = await getValidStaffSession(rawToken);
    expect(session).not.toBeNull();
    expect(session?.staff.fullName).toBe("Alex FrontDesk");
  });

  it("rejects an expired staff session", async () => {
    const rawToken = generateSessionToken();
    const hashedToken = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "session_expired",
      sessionToken: hashedToken,
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      staff: {
        id: "staff_123",
        isActive: true,
      },
    });

    const session = await getValidStaffSession(rawToken);
    expect(session).toBeNull();
  });

  it("rejects a revoked staff session", async () => {
    const rawToken = generateSessionToken();
    const hashedToken = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "session_revoked",
      sessionToken: hashedToken,
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: new Date(),
      staff: {
        id: "staff_123",
        isActive: true,
      },
    });

    const session = await getValidStaffSession(rawToken);
    expect(session).toBeNull();
  });

  it("rejects session if staff member is deactivated (isActive = false)", async () => {
    const rawToken = generateSessionToken();
    const hashedToken = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "session_deactivated_staff",
      sessionToken: hashedToken,
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
      staff: {
        id: "staff_deactivated",
        isActive: false,
      },
    });

    const session = await getValidStaffSession(rawToken);
    expect(session).toBeNull();
  });

  it("successfully revokes an active staff session", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.updateMany as any).mockResolvedValue({ count: 1 });

    const revoked = await revokeStaffSession(rawToken);
    expect(revoked).toBe(true);
    expect(prisma.staffSession.updateMany).toHaveBeenCalledWith({
      where: {
        sessionToken: hashed,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });
});

describe("Staff Login API Route (POST /api/auth/staff/login)", () => {
  beforeEach(() => {
    resetRateLimitStore();
    vi.clearAllMocks();
  });

  it("successfully logs in valid FRONT_DESK staff with Argon2id hash", async () => {
    const testPassword = "ValidPassword123!";
    const testHash = await hashPassword(testPassword);

    (prisma.staff.findFirst as any).mockResolvedValue({
      id: "staff_desk_01",
      fullName: "Blessing FrontDesk",
      email: "blessing@spottergym.com",
      phoneNumber: "08011223344",
      passwordHash: testHash,
      role: "FRONT_DESK",
      isActive: true,
    });

    (prisma.staffSession.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: "sess_created_1",
        staffId: data.staffId,
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt,
      })
    );

    const req = new Request("http://localhost:3000/api/auth/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "blessing@spottergym.com",
        password: testPassword,
      }),
    });

    const res = await staffLoginRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.staff.fullName).toBe("Blessing FrontDesk");
    expect(data.staff.role).toBe("FRONT_DESK");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(STAFF_COOKIE_NAME);
    expect(setCookie?.toLowerCase()).toContain("httponly");
  });

  it("rejects login with invalid password (401 generic error)", async () => {
    const correctPassword = "CorrectPassword123!";
    const testHash = await hashPassword(correctPassword);

    (prisma.staff.findFirst as any).mockResolvedValue({
      id: "staff_desk_02",
      fullName: "Alex FrontDesk",
      email: "alex@spottergym.com",
      passwordHash: testHash,
      role: "FRONT_DESK",
      isActive: true,
    });

    const req = new Request("http://localhost:3000/api/auth/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "alex@spottergym.com",
        password: "WrongPassword999!",
      }),
    });

    const res = await staffLoginRoute(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBe(
      "Invalid staff credentials. Please check your details and try again."
    );
  });

  it("rejects nonexistent staff with identical generic error (prevents enumeration)", async () => {
    (prisma.staff.findFirst as any).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/auth/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "nonexistent@spottergym.com",
        password: "SomePassword123!",
      }),
    });

    const res = await staffLoginRoute(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBe(
      "Invalid staff credentials. Please check your details and try again."
    );
  });

  it("rejects inactive staff account (403)", async () => {
    const testPassword = "ValidPassword123!";
    const testHash = await hashPassword(testPassword);

    (prisma.staff.findFirst as any).mockResolvedValue({
      id: "staff_inactive_03",
      fullName: "Inactive Staff",
      email: "inactive@spottergym.com",
      passwordHash: testHash,
      role: "FRONT_DESK",
      isActive: false,
    });

    const req = new Request("http://localhost:3000/api/auth/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "inactive@spottergym.com",
        password: testPassword,
      }),
    });

    const res = await staffLoginRoute(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toContain("Staff account is deactivated");
  });

  it("rejects unauthorized staff role (403)", async () => {
    const testPassword = "ValidPassword123!";
    const testHash = await hashPassword(testPassword);

    (prisma.staff.findFirst as any).mockResolvedValue({
      id: "staff_unauthorized_04",
      fullName: "Other Role Staff",
      email: "other@spottergym.com",
      passwordHash: testHash,
      role: "MAINTENANCE" as any,
      isActive: true,
    });

    const req = new Request("http://localhost:3000/api/auth/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "other@spottergym.com",
        password: testPassword,
      }),
    });

    const res = await staffLoginRoute(req);
    expect(res.status).toBe(403);

    const data = await res.json();
    expect(data.error).toContain("Access denied");
  });

  it("enforces IP-based rate limiting on staff login attempts (5 max)", async () => {
    const ip = "10.0.0.99";

    for (let i = 0; i < 5; i++) {
      checkRateLimit(`staff-login:${ip}`, 5);
    }

    const req = new Request("http://localhost:3000/api/auth/staff/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({
        identifier: "test@spottergym.com",
        password: "AnyPassword123!",
      }),
    });

    const res = await staffLoginRoute(req);
    expect(res.status).toBe(429);

    const data = await res.json();
    expect(data.error).toContain("Too many login attempts");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("Staff Logout API Route (POST /api/auth/staff/logout)", () => {
  it("clears the spotter_staff_session cookie and returns 200", async () => {
    const req = new Request("http://localhost:3000/api/auth/staff/logout", {
      method: "POST",
    });
    const res = await staffLogoutRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(STAFF_COOKIE_NAME);
    expect(setCookie).toContain("Max-Age=0");
  });
});

describe("Server-Side Member Number Generation (lib/member-number.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a member number conforming to format SPT-YYYY-XXXX", async () => {
    (prisma.member.findUnique as any).mockResolvedValue(null);

    const number = await generateServerMemberNumber();
    const currentYear = new Date().getFullYear();

    expect(number).toMatch(new RegExp(`^SPT-${currentYear}-\\d{4,6}$`));
  });

  it("retries and avoids collisions if candidate already exists in database", async () => {
    const currentYear = new Date().getFullYear();
    // Simulate collision on first lookup, success on second
    (prisma.member.findUnique as any)
      .mockResolvedValueOnce({ id: "colliding_member", memberNumber: `SPT-${currentYear}-1234` })
      .mockResolvedValueOnce(null);

    const number = await generateServerMemberNumber();
    expect(number).toBeDefined();
    expect(number.startsWith(`SPT-${currentYear}-`)).toBe(true);
    expect(prisma.member.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe("Member Number Generation API (POST /api/staff/generate-member-number)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests without staff session cookie (401)", async () => {
    const req = new Request("http://localhost:3000/api/staff/generate-member-number", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Intending Member",
        phoneNumber: "08012345678",
      }),
    });

    const res = await generateMemberNumberRoute(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toContain("Unauthorized");
  });

  it("rejects request if member cookie (spotter_session) is provided instead of staff cookie", async () => {
    const req = new Request("http://localhost:3000/api/staff/generate-member-number", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "spotter_session=raw-member-session-token",
      },
      body: JSON.stringify({
        fullName: "Intending Member",
        phoneNumber: "08012345678",
      }),
    });

    const res = await generateMemberNumberRoute(req);
    expect(res.status).toBe(401);
  });

  it("rejects unauthorized staff role (403)", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_unauth",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_unauth",
        role: "TRAINER" as any,
        isActive: true,
      },
    });

    const req = new Request("http://localhost:3000/api/staff/generate-member-number", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${STAFF_COOKIE_NAME}=${rawToken}`,
      },
      body: JSON.stringify({
        fullName: "Intending Member",
        phoneNumber: "08012345678",
      }),
    });

    const res = await generateMemberNumberRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("not authorized");
  });

  it("generates unique member number for new intending member (201)", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_auth",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_desk_1",
        fullName: "Blessing Desk",
        role: "FRONT_DESK",
        isActive: true,
      },
    });

    // No existing member with this phone number, and candidate number is unique
    (prisma.member.findUnique as any).mockResolvedValue(null);

    (prisma.member.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: "new_member_123",
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        memberNumber: data.memberNumber,
        tier: data.tier,
        createdAt: new Date(),
      })
    );

    const req = new Request("http://localhost:3000/api/staff/generate-member-number", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${STAFF_COOKIE_NAME}=${rawToken}`,
      },
      body: JSON.stringify({
        fullName: "Chinedu Okafor",
        phoneNumber: "08033445566",
        tier: "PREMIUM",
      }),
    });

    const res = await generateMemberNumberRoute(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.action).toBe("CREATED_INTENDING_MEMBER");
    expect(data.member.memberNumber).toMatch(/^SPT-\d{4}-\d+$/);
    expect(data.member.fullName).toBe("Chinedu Okafor");
    expect(data.member.tier).toBe("PREMIUM");
  });

  it("allocates new unique member number to existing member lacking one (200)", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_auth",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_desk_1",
        role: "FRONT_DESK",
        isActive: true,
      },
    });

    // Existing member found without memberNumber
    (prisma.member.findUnique as any)
      .mockResolvedValueOnce({
        id: "existing_no_num",
        fullName: "Existing Member",
        phoneNumber: "08055667788",
        memberNumber: null,
        tier: "BASIC",
      })
      // Candidate check returns null (candidate is unique)
      .mockResolvedValueOnce(null);

    (prisma.member.update as any).mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: "existing_no_num",
        fullName: "Existing Member",
        phoneNumber: "08055667788",
        memberNumber: data.memberNumber,
        tier: "BASIC",
      })
    );

    const req = new Request("http://localhost:3000/api/staff/generate-member-number", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${STAFF_COOKIE_NAME}=${rawToken}`,
      },
      body: JSON.stringify({
        fullName: "Existing Member",
        phoneNumber: "08055667788",
      }),
    });

    const res = await generateMemberNumberRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.action).toBe("ALLOCATED_TO_EXISTING");
    expect(data.member.memberNumber).toMatch(/^SPT-\d{4}-\d+$/);
  });

  it("returns conflict (409) if member already possesses an allocated member number", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_auth",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_desk_1",
        role: "FRONT_DESK",
        isActive: true,
      },
    });

    // Existing member already has a member number
    (prisma.member.findUnique as any).mockResolvedValue({
      id: "existing_with_num",
      fullName: "Already Registered",
      phoneNumber: "08099887766",
      memberNumber: "SPT-2026-1111",
      tier: "BASIC",
    });

    const req = new Request("http://localhost:3000/api/staff/generate-member-number", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${STAFF_COOKIE_NAME}=${rawToken}`,
      },
      body: JSON.stringify({
        fullName: "Already Registered",
        phoneNumber: "08099887766",
      }),
    });

    const res = await generateMemberNumberRoute(req);
    expect(res.status).toBe(409);

    const data = await res.json();
    expect(data.error).toContain("Member is already registered with member number: SPT-2026-1111");
  });
});

describe("Database-Backed Role-Based Access Control (lib/rbac.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authorizes FRONT_DESK role from database", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_1",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_1",
        fullName: "Front Desk Staff",
        role: StaffRole.FRONT_DESK,
        isActive: true,
      },
    });

    const result = await requireStaffRole(rawToken);
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.staff.role).toBe(StaffRole.FRONT_DESK);
    }
  });

  it("authorizes OWNER role for receptionist operations", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_owner",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_owner",
        fullName: "Gym Owner",
        role: StaffRole.OWNER,
        isActive: true,
      },
    });

    const result = await requireStaffRole(rawToken);
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.staff.role).toBe(StaffRole.OWNER);
    }
  });

  it("rejects unauthorized staff role from database", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_trainer",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_trainer",
        fullName: "Gym Trainer",
        role: "TRAINER" as any,
        isActive: true,
      },
    });

    const result = await requireStaffRole(rawToken, [StaffRole.FRONT_DESK]);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.reason).toBe("FORBIDDEN");
      expect(result.status).toBe(403);
    }
  });

  it("rejects unauthenticated requests without session token", async () => {
    const result = await requireStaffRole(null);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.reason).toBe("UNAUTHENTICATED");
      expect(result.status).toBe(401);
    }
  });

  it("rejects inactive/deactivated staff members", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_inactive",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_inactive",
        fullName: "Deactivated Staff",
        role: StaffRole.FRONT_DESK,
        isActive: false,
      },
    });

    const result = await requireStaffRole(rawToken);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.reason).toBe("STAFF_INACTIVE");
      expect(result.status).toBe(403);
    }
  });

  it("rejects revoked staff sessions", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_revoked",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: new Date(),
      staff: {
        id: "staff_1",
        role: StaffRole.FRONT_DESK,
        isActive: true,
      },
    });

    const result = await requireStaffRole(rawToken);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.reason).toBe("SESSION_REVOKED");
      expect(result.status).toBe(401);
    }
  });

  it("client-provided role cannot override database role", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_front_desk",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_fd",
        fullName: "Real Front Desk",
        role: StaffRole.FRONT_DESK,
        isActive: true,
      },
    });

    const req = new Request("http://localhost:3000/api/staff/test?role=OWNER", {
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${rawToken}; role=OWNER`,
        "x-staff-role": "OWNER",
      },
      body: JSON.stringify({ role: "OWNER" }),
      method: "POST",
    });

    const result = await requireStaffRoleFromRequest(req, [StaffRole.OWNER]);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.reason).toBe("FORBIDDEN");
      expect(result.status).toBe(403);
    }
  });

  it("changing a staff role in database dynamically updates authorization", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValueOnce({
      id: "sess_changing",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_dyn",
        role: StaffRole.FRONT_DESK,
        isActive: true,
      },
    });

    const firstCheck = await requireStaffRole(rawToken, [StaffRole.FRONT_DESK]);
    expect(firstCheck.authorized).toBe(true);

    (prisma.staffSession.findUnique as any).mockResolvedValueOnce({
      id: "sess_changing",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_dyn",
        role: "RETIRED" as any,
        isActive: true,
      },
    });

    const secondCheck = await requireStaffRole(rawToken, [StaffRole.FRONT_DESK]);
    expect(secondCheck.authorized).toBe(false);
    if (!secondCheck.authorized) {
      expect(secondCheck.reason).toBe("FORBIDDEN");
    }
  });

  it("member session (spotter_session) cannot authorize staff operations", async () => {
    const req = new Request("http://localhost:3000/api/staff/generate-member-number", {
      headers: {
        cookie: "spotter_session=raw-member-session-token",
      },
    });

    const result = await requireStaffRoleFromRequest(req);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.reason).toBe("UNAUTHENTICATED");
      expect(result.status).toBe(401);
    }
  });

  it("OWNER can generate member numbers via generate-member-number endpoint", async () => {
    const rawToken = generateSessionToken();
    const hashed = hashSessionToken(rawToken);

    (prisma.staffSession.findUnique as any).mockResolvedValue({
      id: "sess_owner",
      sessionToken: hashed,
      expiresAt: new Date(Date.now() + 3600000),
      revokedAt: null,
      staff: {
        id: "staff_owner_1",
        fullName: "Owner Boss",
        role: StaffRole.OWNER,
        isActive: true,
      },
    });

    (prisma.member.findUnique as any).mockResolvedValue(null);
    (prisma.member.create as any).mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: "new_owner_created_member",
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        memberNumber: data.memberNumber,
        tier: data.tier,
        createdAt: new Date(),
      })
    );

    const req = new Request("http://localhost:3000/api/staff/generate-member-number", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${STAFF_COOKIE_NAME}=${rawToken}`,
      },
      body: JSON.stringify({
        fullName: "VIP Intending Member",
        phoneNumber: "08011223344",
        tier: "PREMIUM",
      }),
    });

    const res = await generateMemberNumberRoute(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.member.memberNumber).toMatch(/^SPT-\d{4}-\d+$/);
  });
});

