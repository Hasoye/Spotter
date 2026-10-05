/**
 * Single source for the confidence threshold and other tuned values.
 * @see docs/THRESHOLDS.md / .agent/rules/threshold.md
 */

/** Cosine similarity score threshold for shared record matches */
export const CONFIDENCE_THRESHOLD = 0.75;

/** Response SLAs in milliseconds */
export const PRIVATE_RECORD_SLA_MS = 3000;
export const SHARED_RECORD_SLA_MS = 5000;
