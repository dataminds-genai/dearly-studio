import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
        resend: vi.fn(),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
      }),
    },
  };
});

describe("Auth context module", () => {
  it("exports AuthProvider and useAuth hook", async () => {
    const authModule = await import("../auth-context");
    expect(authModule.AuthProvider).toBeDefined();
    expect(authModule.useAuth).toBeDefined();
  });
});
