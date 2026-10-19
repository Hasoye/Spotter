import { NextResponse } from "next/server";
import { purgeExpiredSoftDeletedAccounts } from "../../../../lib/account-deletion";
import { logger } from "../../../../lib/logger";

function verifyCronAuthorization(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // If CRON_SECRET is not configured in dev, only allow localhost requests
    return true;
  }

  const authHeader =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return authHeader === cronSecret;
}

export async function POST(request: Request) {
  try {
    if (!verifyCronAuthorization(request)) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing cron secret" },
        { status: 401 }
      );
    }

    const result = await purgeExpiredSoftDeletedAccounts();

    return NextResponse.json(
      {
        success: true,
        message: "Account deletion purge maintenance completed successfully",
        timestamp: new Date().toISOString(),
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error(
      "Failed to execute account deletion purge maintenance job",
      { operation: "purgeAccountsCron" },
      error
    );

    return NextResponse.json(
      { error: "Internal server error during account purge execution" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
