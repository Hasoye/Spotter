import { describe, it, expect } from "vitest";
import { CONFIDENCE_THRESHOLD, PRIVATE_RECORD_SLA_MS, SHARED_RECORD_SLA_MS } from "./constants";

describe("lib/constants", () => {
  it("exports exact confidence threshold matching rules", () => {
    expect(CONFIDENCE_THRESHOLD).toBe(0.75);
  });

  it("exports SLA bounds matching AGENTS.md requirements", () => {
    expect(PRIVATE_RECORD_SLA_MS).toBe(3000);
    expect(SHARED_RECORD_SLA_MS).toBe(5000);
  });
});
