import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getClientHash,
  recordGenerationServer,
  getGenerationStatusServer,
} from "../generation-tracker.server";
import { resetRuntimeGenerationConfig } from "../generation-limit";

describe("generation-tracker.server", () => {
  beforeEach(() => {
    resetRuntimeGenerationConfig();
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

  describe("recordGenerationServer and getGenerationStatusServer", () => {
    it("tracks and enforces limits using memory fallback when Supabase is not mocked", async () => {
      const userId = "test-user-" + Date.now();

      // Check initial status
      const initial = await getGenerationStatusServer(userId, "127.0.0.1", "agent");
      expect(initial.count).toBe(0);
      expect(initial.remaining).toBeGreaterThan(0);
      expect(initial.allowed).toBe(true);

      // Record first generation
      const first = await recordGenerationServer(userId, "127.0.0.1", "agent", "watercolor");
      expect(first.count).toBe(1);
      expect(first.allowed).toBe(true);
      expect(first.remaining).toBe(first.limit - 1);

      // Status check should reflect the recorded generation
      const after = await getGenerationStatusServer(userId, "127.0.0.1", "agent");
      expect(after.count).toBe(1);
      expect(after.remaining).toBe(first.limit - 1);
    });

    it("handles Supabase RPC success response cleanly", async () => {
      const mockRpcResponse = {
        allowed: true,
        count: 2,
        remaining: 8,
        limit: 10,
        reset_ms: 72000000,
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockRpcResponse), { status: 200 }),
      );

      const res = await recordGenerationServer("mock-user", "10.0.0.1", "ua", "sketch");
      expect(res.source).toBe("supabase");
      expect(res.count).toBe(2);
      expect(res.remaining).toBe(8);
      expect(res.allowed).toBe(true);
      expect(res.resetMs).toBe(72000000);
    });

    it("handles Supabase RPC rate-limit hit", async () => {
      const mockRpcResponse = {
        allowed: false,
        count: 10,
        remaining: 0,
        limit: 10,
        reset_ms: 45000000,
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockRpcResponse), { status: 200 }),
      );

      const res = await recordGenerationServer("mock-user-capped", "10.0.0.1", "ua");
      expect(res.source).toBe("supabase");
      expect(res.allowed).toBe(false);
      expect(res.count).toBe(10);
      expect(res.remaining).toBe(0);
      expect(res.resetMs).toBe(45000000);
    });
  });
});
