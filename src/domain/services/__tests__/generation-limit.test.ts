import { describe, it, expect, beforeEach, vi } from "vitest";
import { toast } from "sonner";
import {
  pruneTimestamps,
  formatTimeRemaining,
  getGenerationConfig,
  getGenerationStatus,
  recordGeneration,
  notifyLimitReached,
  GENERATION_WINDOW_MS,
  DEFAULT_DAILY_IMAGE_LIMIT_LOGGED_IN,
  DEFAULT_DAILY_IMAGE_LIMIT_ANON,
  DEFAULT_DAILY_IMAGE_WARNING_THRESHOLD,
  resetRuntimeGenerationConfig,
} from "../generation-limit";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

describe("generation-limit service", () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();
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

    it("starts with full allowance (15 remaining)", () => {
      const status = getGenerationStatus(userId);
      expect(status.limit).toBe(15);
      expect(status.count).toBe(0);
      expect(status.remaining).toBe(15);
      expect(status.isAllowed).toBe(true);
      expect(status.shouldWarn).toBe(false);
      expect(status.isLimitReached).toBe(false);
    });

    it("shows warning when reaching the warning threshold (7 generations)", () => {
      const now = 100_000_000;
      for (let i = 0; i < 7; i++) {
        recordGeneration(userId, now + i * 1000);
      }
      const status = getGenerationStatus(userId, now + 10_000);
      expect(status.count).toBe(7);
      expect(status.remaining).toBe(8);
      expect(status.shouldWarn).toBe(true);
      expect(status.isAllowed).toBe(true);
      expect(status.isLimitReached).toBe(false);
    });

    it("enforces cap when reaching max (15 generations) and calculates reset countdown", () => {
      const baseTime = 100_000_000;
      for (let i = 0; i < 15; i++) {
        recordGeneration(userId, baseTime + i * 1000);
      }
      const status = getGenerationStatus(userId, baseTime + 20_000);
      expect(status.count).toBe(15);
      expect(status.remaining).toBe(0);
      expect(status.isAllowed).toBe(false);
      expect(status.isLimitReached).toBe(true);
      expect(status.msUntilNextReset).toBeGreaterThan(0);
      expect(status.formattedResetTime).toContain("hr");
    });
  });

  describe("for anonymous/guest users", () => {
    it("starts with 3 images allowance", () => {
      const status = getGenerationStatus(null);
      expect(status.limit).toBe(3);
      expect(status.count).toBe(0);
      expect(status.remaining).toBe(3);
      expect(status.isAllowed).toBe(true);
      expect(status.isLimitReached).toBe(false);
    });

    it("reaches limit after 3 generations", () => {
      const now = 200_000_000;
      for (let i = 0; i < 3; i++) {
        recordGeneration(null, now + i * 1000);
      }
      const status = getGenerationStatus(null, now + 5000);
      expect(status.count).toBe(3);
      expect(status.remaining).toBe(0);
      expect(status.isAllowed).toBe(false);
      expect(status.isLimitReached).toBe(true);
    });
  });

  describe("server-side runtime environment bindings", () => {
    beforeEach(() => {
      resetRuntimeGenerationConfig();
      delete (globalThis as Record<string, unknown>)["__CLOUDFLARE_ENV__"];
    });

    it("reads limits from Cloudflare Worker env bindings when running on server", () => {
      vi.stubGlobal("window", undefined);
      (globalThis as Record<string, unknown>)["__CLOUDFLARE_ENV__"] = {
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
      (globalThis as Record<string, unknown>)["__CLOUDFLARE_ENV__"] = {
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
    it("discards stale legacy default config {10, 1, 5} from localStorage", () => {
      mockStorage["dearly_synced_generation_config"] = JSON.stringify({
        limitLoggedIn: 10,
        limitAnon: 1,
        warningThreshold: 5,
      });

      const config = getGenerationConfig();
      expect(config.limitLoggedIn).toBe(DEFAULT_DAILY_IMAGE_LIMIT_LOGGED_IN); // 15
      expect(config.limitAnon).toBe(DEFAULT_DAILY_IMAGE_LIMIT_ANON); // 3
      expect(config.warningThreshold).toBe(DEFAULT_DAILY_IMAGE_WARNING_THRESHOLD); // 7
      expect(mockStorage["dearly_synced_generation_config"]).toBeUndefined();
    });
  });

  describe("syncGenerationStatus reconciliation", () => {
    it("reconciles localStorage downwards when database has fewer generations", async () => {
      const userId = "user-reconcile-test";
      const key = `dearly_gen_limit_user_${userId}`;
      const now = Date.now();
      // Simulate 10 stale timestamps in localStorage
      const oldTen = Array.from({ length: 10 }, (_, i) => now - (10 - i) * 1000);
      mockStorage[key] = JSON.stringify(oldTen);

      // Server returns count: 1 (e.g. only 1 row in database)
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            count: 1,
            limit: 15,
            remaining: 14,
            isAllowed: true,
            shouldWarn: false,
            isLimitReached: false,
            isLoggedIn: true,
            msUntilNextReset: 86400000,
            formattedResetTime: "24 hrs",
            warningThreshold: 7,
          }),
        }),
      );

      const { syncGenerationStatus, loadGenerationTimestamps } = await import("../generation-limit");
      const result = await syncGenerationStatus(userId);

      expect(result?.count).toBe(1);
      const updated = loadGenerationTimestamps(userId);
      expect(updated.length).toBe(1);
    });
  });

  describe("notifyLimitReached", () => {
    it("dispatches modal event and shows limit exceeded error toast for logged in users", () => {
      const dispatchSpy = vi.fn();
      vi.stubGlobal("window", {
        dispatchEvent: dispatchSpy,
      });

      const status = {
        limit: 10,
        limitLoggedIn: 10,
        limitAnon: 1,
        count: 10,
        remaining: 0,
        isAllowed: false,
        shouldWarn: false,
        isLimitReached: true,
        isLoggedIn: true,
        msUntilNextReset: 3600000,
        formattedResetTime: "1 hr",
        warningThreshold: 5,
      };

      notifyLimitReached(status);

      expect(dispatchSpy).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("Daily limit exceeded. You have reached your daily limit of 10 artworks"),
        expect.objectContaining({
          description: expect.stringContaining("1 hr"),
        }),
      );
    });

    it("dispatches modal event and prompts registration for guest users with X daily generations", () => {
      const dispatchSpy = vi.fn();
      vi.stubGlobal("window", {
        dispatchEvent: dispatchSpy,
      });

      const status = {
        limit: 1,
        limitLoggedIn: 10,
        limitAnon: 1,
        count: 1,
        remaining: 0,
        isAllowed: false,
        shouldWarn: false,
        isLimitReached: true,
        isLoggedIn: false,
        msUntilNextReset: 3600000,
        formattedResetTime: "1 hr",
        warningThreshold: 5,
      };

      notifyLimitReached(status);

      expect(dispatchSpy).toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining("Register first to get 10 daily artwork generations"),
        expect.objectContaining({
          action: expect.objectContaining({ label: "Register" }),
        }),
      );
    });
  });
});
