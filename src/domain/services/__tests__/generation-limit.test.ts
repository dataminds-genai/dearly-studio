import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pruneTimestamps,
  formatTimeRemaining,
  getGenerationConfig,
  getGenerationStatus,
  recordGeneration,
  GENERATION_WINDOW_MS,
  DEFAULT_DAILY_IMAGE_LIMIT_LOGGED_IN,
  DEFAULT_DAILY_IMAGE_LIMIT_ANON,
  DEFAULT_DAILY_IMAGE_WARNING_THRESHOLD,
  resetRuntimeGenerationConfig,
} from "../generation-limit";

describe("generation-limit service", () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }

    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
    });

    vi.stubGlobal("window", {
      localStorage,
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it("reads default generation limits correctly", () => {
    const config = getGenerationConfig();
    expect(config.limitLoggedIn).toBe(DEFAULT_DAILY_IMAGE_LIMIT_LOGGED_IN);
    expect(config.limitAnon).toBe(DEFAULT_DAILY_IMAGE_LIMIT_ANON);
    expect(config.warningThreshold).toBe(DEFAULT_DAILY_IMAGE_WARNING_THRESHOLD);
  });

  it("formats remaining milliseconds into readable time strings", () => {
    expect(formatTimeRemaining(0)).toBe("soon");
    expect(formatTimeRemaining(45 * 60 * 1000)).toBe("45 mins");
    expect(formatTimeRemaining(2 * 60 * 60 * 1000)).toBe("2 hrs");
    expect(formatTimeRemaining(2 * 60 * 60 * 1000 + 15 * 60 * 1000)).toBe("2 hrs 15 mins");
  });

  it("prunes timestamps older than 24 hours", () => {
    const now = 100_000_000;
    const recent = now - 1000;
    const old = now - GENERATION_WINDOW_MS - 1000;
    const pruned = pruneTimestamps([old, recent], now);
    expect(pruned).toEqual([recent]);
  });

  describe("for logged-in users", () => {
    const userId = "test-user-123";

    it("starts with full allowance (10 remaining)", () => {
      const status = getGenerationStatus(userId);
      expect(status.limit).toBe(10);
      expect(status.count).toBe(0);
      expect(status.remaining).toBe(10);
      expect(status.isAllowed).toBe(true);
      expect(status.shouldWarn).toBe(false);
      expect(status.isLimitReached).toBe(false);
    });

    it("shows warning when reaching the warning threshold (5 generations)", () => {
      const now = 100_000_000;
      for (let i = 0; i < 5; i++) {
        recordGeneration(userId, now + i * 1000);
      }
      const status = getGenerationStatus(userId, now + 10_000);
      expect(status.count).toBe(5);
      expect(status.remaining).toBe(5);
      expect(status.shouldWarn).toBe(true);
      expect(status.isAllowed).toBe(true);
      expect(status.isLimitReached).toBe(false);
    });

    it("enforces cap when reaching max (10 generations) and calculates reset countdown", () => {
      const baseTime = 100_000_000;
      for (let i = 0; i < 10; i++) {
        recordGeneration(userId, baseTime + i * 1000);
      }
      const status = getGenerationStatus(userId, baseTime + 15_000);
      expect(status.count).toBe(10);
      expect(status.remaining).toBe(0);
      expect(status.isAllowed).toBe(false);
      expect(status.isLimitReached).toBe(true);
      expect(status.msUntilNextReset).toBeGreaterThan(0);
      expect(status.formattedResetTime).toContain("hr");
    });
  });

  describe("for anonymous/guest users", () => {
    it("starts with 1 image allowance", () => {
      const status = getGenerationStatus(null);
      expect(status.limit).toBe(1);
      expect(status.count).toBe(0);
      expect(status.remaining).toBe(1);
      expect(status.isAllowed).toBe(true);
      expect(status.isLimitReached).toBe(false);
    });

    it("reaches limit after 1 generation", () => {
      const now = 200_000_000;
      recordGeneration(null, now);
      const status = getGenerationStatus(null, now + 1000);
      expect(status.count).toBe(1);
      expect(status.remaining).toBe(0);
      expect(status.isAllowed).toBe(false);
      expect(status.isLimitReached).toBe(true);
    });
  });

  describe("server-side runtime environment bindings", () => {
    beforeEach(() => {
      resetRuntimeGenerationConfig();
      delete (globalThis as Record<string, unknown>).__CLOUDFLARE_ENV__;
    });

    it("reads limits from Cloudflare Worker env bindings when running on server", () => {
      vi.stubGlobal("window", undefined);
      (globalThis as Record<string, unknown>).__CLOUDFLARE_ENV__ = {
        DAILY_IMAGE_LIMIT_LOGGED_IN: "25",
        DAILY_IMAGE_LIMIT_ANON: "3",
        DAILY_IMAGE_WARNING_THRESHOLD: "15",
      };

      const config = getGenerationConfig();
      expect(config.limitLoggedIn).toBe(25);
      expect(config.limitAnon).toBe(3);
      expect(config.warningThreshold).toBe(15);
    });

    it("supports case-insensitive and common alias variable names from Cloudflare dashboard", () => {
      vi.stubGlobal("window", undefined);
      (globalThis as Record<string, unknown>).__CLOUDFLARE_ENV__ = {
        daily_limit_logged_in: "50",
        daily_limit_anon: "5",
        daily_warning_threshold: "30",
      };

      const config = getGenerationConfig();
      expect(config.limitLoggedIn).toBe(50);
      expect(config.limitAnon).toBe(5);
      expect(config.warningThreshold).toBe(30);
    });

    it("hydrates from cached localStorage on client before server sync completes", () => {
      mockStorage["dearly_synced_generation_config"] = JSON.stringify({
        limitLoggedIn: 40,
        limitAnon: 4,
        warningThreshold: 20,
      });

      const config = getGenerationConfig();
      expect(config.limitLoggedIn).toBe(40);
      expect(config.limitAnon).toBe(4);
      expect(config.warningThreshold).toBe(20);
    });
  });
});
