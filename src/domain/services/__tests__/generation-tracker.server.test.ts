import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getClientHash,
  recordGenerationServer,
  getGenerationStatusServer,
  getDynamicGenerationConfig,
  resetDynamicConfigCache,
} from "../generation-tracker.server";
import { resetRuntimeGenerationConfig } from "../generation-limit";

describe("generation-tracker.server", () => {
  beforeEach(() => {
    resetRuntimeGenerationConfig();
    resetDynamicConfigCache();
    vi.restoreAllMocks();
  });

  describe("getClientHash", () => {
    it("generates deterministic and non-empty hash from IP and user-agent", async () => {
      const hash1 = await getClientHash("192.168.1.1", "Mozilla/5.0");
      const hash2 = await getClientHash("192.168.1.1", "Mozilla/5.0");
      const hashDiff = await getClientHash("192.168.1.2", "Mozilla/5.0");

      expect(hash1).toBeDefined();
      expect(hash1.length).toBeGreaterThan(0);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashDiff);
    });
  });

  describe("getDynamicGenerationConfig", () => {
    it("fetches dynamic limits from Supabase app_config and caches for 60s", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              value: {
                registered: 25,
                guest: 5,
                warning_threshold: 12,
              },
            },
          ]),
          { status: 200 },
        ),
      );

      const config1 = await getDynamicGenerationConfig();
      expect(config1.limitLoggedIn).toBe(25);
      expect(config1.limitAnon).toBe(5);
      expect(config1.warningThreshold).toBe(12);

      // Second call within 60s should use in-memory cache without calling fetch again
      const config2 = await getDynamicGenerationConfig();
      expect(config2.limitLoggedIn).toBe(25);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("falls back gracefully when Supabase app_config query fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network failure"));

      const config = await getDynamicGenerationConfig();
      expect(config.limitLoggedIn).toBe(15);
      expect(config.limitAnon).toBe(3);
      expect(config.warningThreshold).toBe(7);
    });
  });

  describe("recordGenerationServer and getGenerationStatusServer", () => {
    it("tracks and enforces limits using memory fallback when Supabase is not reachable", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Supabase unavailable"));
      const userId = "test-user-" + Date.now();

      // Check initial status
      const initial = await getGenerationStatusServer(userId, "127.0.0.1", "agent");
      expect(initial.count).toBe(0);
      expect(initial.remaining).toBe(15);
      expect(initial.allowed).toBe(true);

      // Record first generation
      const first = await recordGenerationServer(userId, "127.0.0.1", "agent", "watercolor");
      expect(first.count).toBe(1);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(14);

      // Status check should reflect the recorded generation
      const after = await getGenerationStatusServer(userId, "127.0.0.1", "agent");
      expect(after.count).toBe(1);
      expect(after.remaining).toBe(14);
    });

    it("handles Supabase RPC success response cleanly", async () => {
      const mockRpcResponse = {
        allowed: true,
        count: 2,
        remaining: 13,
        limit: 15,
        reset_ms: 72000000,
      };

      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("app_config")) {
          return new Response(
            JSON.stringify([{ value: { registered: 15, guest: 3, warning_threshold: 7 } }]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify(mockRpcResponse), { status: 200 });
      });

      const res = await recordGenerationServer("mock-user", "10.0.0.1", "ua", "sketch");
      expect(res.source).toBe("supabase");
      expect(res.count).toBe(2);
      expect(res.remaining).toBe(13);
      expect(res.allowed).toBe(true);
      expect(res.resetMs).toBe(72000000);
    });

    it("handles Supabase RPC rate-limit hit", async () => {
      const mockRpcResponse = {
        allowed: false,
        count: 15,
        remaining: 0,
        limit: 15,
        reset_ms: 45000000,
      };

      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("app_config")) {
          return new Response(
            JSON.stringify([{ value: { registered: 15, guest: 3, warning_threshold: 7 } }]),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify(mockRpcResponse), { status: 200 });
      });

      const res = await recordGenerationServer("mock-user-capped", "10.0.0.1", "ua");
      expect(res.source).toBe("supabase");
      expect(res.allowed).toBe(false);
      expect(res.count).toBe(15);
      expect(res.remaining).toBe(0);
      expect(res.resetMs).toBe(45000000);
    });
  });
});
