import { purgeExpiredSoftDeletedAccounts } from "../lib/account-deletion";
import { logger } from "../lib/logger";

async function main() {
  logger.info("Starting scheduled account deletion purge CLI runner...", {
    operation: "cliPurgeAccounts",
  });

  const result = await purgeExpiredSoftDeletedAccounts();

  console.log("=== Account Deletion Purge Results ===");
  console.log(`Purged accounts count: ${result.purgedCount}`);
  console.log(`Failed accounts count: ${result.failedCount}`);
  if (result.purgedMemberIds.length > 0) {
    console.log(`Purged Member IDs: ${result.purgedMemberIds.join(", ")}`);
  }
}

main().catch((err) => {
  console.error("Purge CLI runner failed:", err);
  process.exit(1);
});
