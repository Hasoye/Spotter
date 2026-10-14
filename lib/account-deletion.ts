import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * 30 days grace period in milliseconds before permanent hard purge of data.
 */
export const ACCOUNT_DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccountDeletionStatus {
  isScheduled: boolean;
  scheduledPurgeDate: Date | null;
  isGracePeriodExpired: boolean;
  daysRemaining: number | null;
}

/**
 * Calculates the account deletion schedule and grace period status for a member.
 */
export function getAccountDeletionStatus(
  deactivatedAt: Date | null,
  now: Date = new Date()
): AccountDeletionStatus {
  if (!deactivatedAt) {
    return {
      isScheduled: false,
      scheduledPurgeDate: null,
      isGracePeriodExpired: false,
      daysRemaining: null,
    };
  }

  const scheduledPurgeDate = new Date(
    deactivatedAt.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_MS
  );
  const diffMs = scheduledPurgeDate.getTime() - now.getTime();
  const isGracePeriodExpired = diffMs <= 0;
  const daysRemaining = isGracePeriodExpired
    ? 0
    : Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  return {
    isScheduled: true,
    scheduledPurgeDate,
    isGracePeriodExpired,
    daysRemaining,
  };
}

/**
 * Soft deletes an account by setting deactivatedAt to the current timestamp,
 * marking isActive as false, and revoking all active member sessions.
 * Returns the exact scheduled purge date after the 30-day grace period.
 */
export async function scheduleMemberAccountDeletion(
  memberId: string,
  now: Date = new Date()
): Promise<{ scheduledPurgeDate: Date; memberId: string }> {
  const scheduledPurgeDate = new Date(
    now.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_MS
  );

  await prisma.$transaction(async (tx) => {
    // 1. Mark member as deactivated (soft delete)
    await tx.member.update({
      where: { id: memberId },
      data: {
        deactivatedAt: now,
        isActive: false,
      },
    });

    // 2. Revoke all active sessions immediately
    await tx.memberSession.updateMany({
      where: {
        memberId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });
  });

  logger.info(
    "Account scheduled for soft deletion with 30-day grace period",
    {
      operation: "scheduleMemberAccountDeletion",
      memberId,
      scheduledPurgeDate: scheduledPurgeDate.toISOString(),
    }
  );

  return {
    memberId,
    scheduledPurgeDate,
  };
}

/**
 * Hard deletes / purges personal PII for a single member whose grace period has expired.
 * Scrubs fullName, phoneNumber, passwordHash, and access logs while retaining
 * anonymized ledger/payment records to satisfy gym financial audit integrity per PRD.
 */
export async function purgeMemberData(memberId: string): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete all member sessions
      await tx.memberSession.deleteMany({
        where: { memberId },
      });

      // 2. Delete private access logs
      await tx.privateAccessLog.deleteMany({
        where: { memberId },
      });

      // 3. Scrub personal PII from Member record (anonymize while maintaining foreign key integrity for payments/ledger)
      await tx.member.update({
        where: { id: memberId },
        data: {
          fullName: "Deleted Member",
          phoneNumber: `deleted_${memberId}`,
          passwordHash: null,
          balanceKobo: 0,
          tier: "BASIC",
          expiresAt: null,
          isActive: false,
        },
      });
    });

    logger.info(
      "Member personal data purged successfully after grace period",
      {
        operation: "purgeMemberData",
        memberId,
      }
    );

    return true;
  } catch (error) {
    logger.error(
      "Failed to purge member data",
      {
        operation: "purgeMemberData",
        memberId,
      },
      error
    );
    return false;
  }
}

/**
 * Scheduled job runner that queries all soft-deleted records whose grace period has expired
 * and purges their personal data from the database.
 */
export async function purgeExpiredSoftDeletedAccounts(
  now: Date = new Date()
): Promise<{
  purgedCount: number;
  purgedMemberIds: string[];
  failedCount: number;
}> {
  const cutoffDate = new Date(
    now.getTime() - ACCOUNT_DELETION_GRACE_PERIOD_MS
  );

  // Find all accounts soft-deleted on or before the cutoff date that have not yet been purged
  const eligibleMembers = await prisma.member.findMany({
    where: {
      deactivatedAt: {
        lte: cutoffDate,
      },
      fullName: {
        not: "Deleted Member",
      },
    },
    select: {
      id: true,
      deactivatedAt: true,
    },
  });

  const purgedMemberIds: string[] = [];
  let failedCount = 0;

  for (const member of eligibleMembers) {
    const success = await purgeMemberData(member.id);
    if (success) {
      purgedMemberIds.push(member.id);
    } else {
      failedCount++;
    }
  }

  logger.info(
    "Completed scheduled account deletion purge run",
    {
      operation: "purgeExpiredSoftDeletedAccounts",
      eligibleCount: eligibleMembers.length,
      purgedCount: purgedMemberIds.length,
      failedCount,
    }
  );

  return {
    purgedCount: purgedMemberIds.length,
    purgedMemberIds,
    failedCount,
  };
}
