import { getGenerationConfig, GENERATION_WINDOW_MS } from "./generation-limit";

export interface ServerGenerationResult {
  allowed: boolean;
  count: number;
  remaining: number;
  limit: number;
  resetMs: number;
  source: "supabase" | "fallback";
}

// In-memory fallback for development or when database is temporarily unreachable
const fallbackMemoryLogs = new Map<string, number[]>();

function checkFallback(
  key: string,
  limit: number,
  record: boolean,
  now = Date.now(),
): ServerGenerationResult {
  const threshold = now - GENERATION_WINDOW_MS;
  const current = (fallbackMemoryLogs.get(key) || []).filter((t) => t > threshold);
  const allowed = current.length < limit;

  if (allowed && record) {
    current.push(now);
    fallbackMemoryLogs.set(key, current);
  }

  const oldest = current[0] ?? now;
  const resetMs = current.length > 0 ? Math.max(0, oldest + GENERATION_WINDOW_MS - now) : 0;
  const count = current.length;
  const remaining = Math.max(0, limit - count);

  return {
    allowed,
    count,
    remaining,
    limit,
    resetMs,
    source: "fallback",
  };
}

/**
 * Computes a privacy-preserving SHA-256 hash of the client IP + User-Agent.
 */
export async function getClientHash(ip: string, userAgent = ""): Promise<string> {
  const raw = `${ip}::${userAgent}::dearly_salt_v1`;
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
    }
  } catch {
    // fallback
  }
  // Simple deterministic fallback
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}

function getSupabaseConfig() {
  const isServer = typeof window === "undefined";
  const globalRec = isServer ? (globalThis as Record<string, unknown>) : {};
  const cfEnv = (globalRec["__env__"] ?? globalRec["__CLOUDFLARE_ENV__"]) as
    | Record<string, unknown>
    | undefined;
  const procEnv = typeof process !== "undefined" ? (process.env as Record<string, unknown>) : {};

  const url =
    (cfEnv?.["SUPABASE_URL"] as string) ??
    (procEnv["SUPABASE_URL"] as string) ??
    "https://yzushppbxjiibcqdiyxc.supabase.co";

  const key =
    (cfEnv?.["SUPABASE_SERVICE_ROLE_KEY"] as string) ??
    (procEnv["SUPABASE_SERVICE_ROLE_KEY"] as string) ??
    (cfEnv?.["SUPABASE_PUBLISHABLE_KEY"] as string) ??
    (procEnv["SUPABASE_PUBLISHABLE_KEY"] as string) ??
    "sb_publishable_dFm1HCFDw1UtkVlNB7ne2w_bJY1iokz";

  return { url: url.replace(/\/$/, ""), key };
}

/**
 * Atomically checks quota and records a generation event via Supabase RPC.
 */
export async function recordGenerationServer(
  userId: string | null,
  clientIp: string,
  userAgent = "",
  style?: string,
): Promise<ServerGenerationResult> {
  const config = getGenerationConfig();
  const isLoggedIn = Boolean(userId);
  const limit = isLoggedIn ? config.limitLoggedIn : config.limitAnon;
  const clientHash = await getClientHash(clientIp, userAgent);
  const fallbackKey = userId ? `user:${userId}` : `hash:${clientHash}`;

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return checkFallback(fallbackKey, limit, true);
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/check_and_record_generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        p_user_id: userId || null,
        p_client_hash: clientHash,
        p_limit: limit,
        p_window_hours: 24,
        p_style: style || null,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        allowed: boolean;
        count: number;
        remaining: number;
        limit: number;
        reset_ms: number;
      };
      return {
        allowed: data.allowed,
        count: data.count,
        remaining: data.remaining,
        limit: data.limit,
        resetMs: data.reset_ms || 0,
        source: "supabase",
      };
    }

    console.warn(`[Supabase Tracker] RPC returned HTTP ${res.status}. Falling back to memory.`);
  } catch (err) {
    console.warn("[Supabase Tracker] Error communicating with Supabase:", err);
  }

  return checkFallback(fallbackKey, limit, true);
}

/**
 * Fetches current generation status without recording a new event.
 */
export async function getGenerationStatusServer(
  userId: string | null,
  clientIp: string,
  userAgent = "",
): Promise<ServerGenerationResult> {
  const config = getGenerationConfig();
  const isLoggedIn = Boolean(userId);
  const limit = isLoggedIn ? config.limitLoggedIn : config.limitAnon;
  const clientHash = await getClientHash(clientIp, userAgent);
  const fallbackKey = userId ? `user:${userId}` : `hash:${clientHash}`;

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return checkFallback(fallbackKey, limit, false);
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_generation_status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        p_user_id: userId || null,
        p_client_hash: clientHash,
        p_limit: limit,
        p_window_hours: 24,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        allowed: boolean;
        count: number;
        remaining: number;
        limit: number;
        reset_ms: number;
      };
      return {
        allowed: data.allowed,
        count: data.count,
        remaining: data.remaining,
        limit: data.limit,
        resetMs: data.reset_ms || 0,
        source: "supabase",
      };
    }
  } catch (err) {
    console.warn("[Supabase Tracker] Error checking status in Supabase:", err);
  }

  return checkFallback(fallbackKey, limit, false);
}
