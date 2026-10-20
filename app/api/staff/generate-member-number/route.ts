import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../../lib/logger";
import { generateMemberNumberSchema } from "../../../../lib/validations";
import {
  getValidStaffSession,
  STAFF_COOKIE_NAME,
} from "../../../../lib/staff-session";
import { generateServerMemberNumber } from "../../../../lib/member-number";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Authenticate staff session server-side
    const cookieHeader = request.headers.get("cookie") || "";
    const regex = new RegExp(`${STAFF_COOKIE_NAME}=([^;]+)`);
    const match = cookieHeader.match(regex);
    const sessionToken = match ? decodeURIComponent(match[1]) : null;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "Unauthorized. Staff session cookie required." },
        { status: 401 }
      );
    }

    const session = await getValidStaffSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Staff session is invalid or expired." },
        { status: 401 }
      );
    }

    // 2. Enforce FRONT_DESK or OWNER role permission
    if (session.staff.role !== "FRONT_DESK" && session.staff.role !== "OWNER") {
      return NextResponse.json(
        { error: "Forbidden. Receptionist (FRONT_DESK) permission required." },
        { status: 403 }
      );
    }

    // 3. Validate request payload
    const body = await request.json();
    const result = generateMemberNumberSchema.safeParse(body);

    if (!result.success) {
      const firstError = result.error.errors[0]?.message || "Invalid member data";
      return NextResponse.json(
        { error: firstError, details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { fullName, phoneNumber, tier } = result.data;

    // 4. Check if member already exists by phone number
    const existingMember = await prisma.member.findUnique({
      where: { phoneNumber },
    });

    if (existingMember) {
      if (existingMember.memberNumber) {
        return NextResponse.json(
          {
            error: `Member is already registered with member number: ${existingMember.memberNumber}`,
            member: {
              id: existingMember.id,
              fullName: existingMember.fullName,
              phoneNumber: existingMember.phoneNumber,
              memberNumber: existingMember.memberNumber,
              tier: existingMember.tier,
            },
          },
          { status: 409 }
        );
      }

      // Existing member lacks memberNumber -> Allocate a fresh unique member number
      const newMemberNumber = await generateServerMemberNumber();
      const updatedMember = await prisma.member.update({
        where: { id: existingMember.id },
        data: { memberNumber: newMemberNumber },
      });

      return NextResponse.json(
        {
          success: true,
          action: "ALLOCATED_TO_EXISTING",
          message: "Unique member number generated and allocated to existing member.",
          member: {
            id: updatedMember.id,
            fullName: updatedMember.fullName,
            phoneNumber: updatedMember.phoneNumber,
            memberNumber: updatedMember.memberNumber,
            tier: updatedMember.tier,
            allocatedAt: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    }

    // 5. Generate trusted unique member number server-side
    const memberNumber = await generateServerMemberNumber();

    // 6. Create intending member record with allocated member number
    const newMember = await prisma.member.create({
      data: {
        fullName,
        phoneNumber,
        memberNumber,
        tier,
      },
    });

    return NextResponse.json(
      {
        success: true,
        action: "CREATED_INTENDING_MEMBER",
        message: "Intending member created and unique member number generated.",
        member: {
          id: newMember.id,
          fullName: newMember.fullName,
          phoneNumber: newMember.phoneNumber,
          memberNumber: newMember.memberNumber,
          tier: newMember.tier,
          createdAt: newMember.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(
      "Failed to generate member number",
      { operation: "generateMemberNumber" },
      error
    );

    return NextResponse.json(
      { error: "An unexpected error occurred while generating the member number." },
      { status: 500 }
    );
  }
}
