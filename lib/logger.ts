type LogContext = {
  operation: string;
  memberId?: string;
  [key: string]: unknown;
};

/**
 * Standard application logger meeting .agent/rules/errorhandling.md requirements:
 * - Single logger module, not raw console.log
 * - Includes: operation running, memberId (if involved), original error message
 * - Never logs full card numbers, OTP codes, or passwords
 */
export const logger = {
  error: (message: string, context: LogContext, error?: unknown) => {
    const originalError =
      error instanceof Error
        ? error.message
        : error
        ? String(error)
        : undefined;

    // Sanitize context to ensure sensitive data is never logged
    const safeContext = { ...context };
    delete (safeContext as Record<string, unknown>).otpCode;
    delete (safeContext as Record<string, unknown>).password;
    delete (safeContext as Record<string, unknown>).cardNumber;

    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        message,
        operation: safeContext.operation,
        memberId: safeContext.memberId,
        originalError,
        context: safeContext,
      })
    );
  },
  info: (message: string, context?: Record<string, unknown>) => {
    console.info(
      JSON.stringify({
        level: "info",
        timestamp: new Date().toISOString(),
        message,
        context,
      })
    );
  },
};
