import { useEffect, useState } from "react";

export const DEFAULT_DAILY_IMAGE_LIMIT_LOGGED_IN = 10;
export const DEFAULT_DAILY_IMAGE_LIMIT_ANON = 1;
export const DEFAULT_DAILY_IMAGE_WARNING_THRESHOLD = 5;
export const GENERATION_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface GenerationConfig {
  limitLoggedIn: number;
  limitAnon: number;
  warningThreshold: number;
}

export interface GenerationStatus {
  limit: number;
  limitLoggedIn: number;
  limitAnon: number;
  count: number;
  remaining: number;
  isAllowed: boolean;
  shouldWarn: boolean;
  isLimitReached: boolean;
  isLoggedIn: boolean;
  msUntilNextReset: number;
  formattedResetTime: string;
  warningThreshold: number;
}

let runtimeServerConfig: GenerationConfig | null = null;

export function resetRuntimeGenerationConfig(): void {
  runtimeServerConfig = null;
}

export function setRuntimeGenerationConfig(cfg: Partial<GenerationConfig>): void {
  const current = getGenerationConfig();
  runtimeServerConfig = {
    limitLoggedIn: cfg.limitLoggedIn ?? current.limitLoggedIn,
    limitAnon: cfg.limitAnon ?? current.limitAnon,
    warningThreshold: cfg.warningThreshold ?? current.warningThreshold,
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        "dearly_synced_generation_config",
        JSON.stringify(runtimeServerConfig),
      );
    } catch {
      // Storage unavailable or disabled
    }
    window.dispatchEvent(new CustomEvent("dearly_generation_updated"));
  }
}

/**
 * Syncs generation configuration with server at runtime, reflecting any dynamic Cloudflare .env updates.
 */
export async function syncGenerationConfig(): Promise<GenerationConfig> {
  if (typeof window === "undefined") return getGenerationConfig();
  try {
    const res = await fetch(`/api/generation-config?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });
    if (res.ok) {
      const data = (await res.json()) as GenerationConfig;
      if (data && typeof data.limitLoggedIn === "number" && data.limitLoggedIn > 0) {
        setRuntimeGenerationConfig(data);
        return data;
      }
    }
  } catch {
    // offline or static preview fallback
  }
  return getGenerationConfig();
}

/**
 * Reads daily generation limits from environment variables with robust fallbacks.
 * Server-side runtime (Cloudflare env bindings / process.env) takes highest precedence,
 * avoiding stale compile-time Vite replacements.
 */
export function getGenerationConfig(): GenerationConfig {
  if (runtimeServerConfig) {
    return runtimeServerConfig;
  }

  // On client, check localStorage cached config from prior server sync
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem("dearly_synced_generation_config");
      if (cached) {
        const parsed = JSON.parse(cached) as GenerationConfig;
        if (parsed && typeof parsed.limitLoggedIn === "number" && parsed.limitLoggedIn > 0) {
          runtimeServerConfig = parsed;
          return runtimeServerConfig;
        }
      }
    } catch {
      // Ignore localStorage access failures
    }
  }

  const parseVal = (val: unknown, fallback: number): number => {
    if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
    if (typeof val === "string") {
      const parsed = parseInt(val.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  };

  let rawLoggedIn: unknown;
  let rawAnon: unknown;
  let rawWarn: unknown;

  // Helper to extract a key with multiple potential aliases and case variations
  const readVar = (
    sources: Array<Record<string, unknown> | undefined>,
    aliases: string[],
  ): unknown => {
    for (const src of sources) {
      if (!src || typeof src !== "object") continue;
      for (const alias of aliases) {
        if (src[alias] !== undefined && src[alias] !== null && String(src[alias]).trim() !== "") {
          return src[alias];
        }
        const lowerAlias = alias.toLowerCase();
        for (const [k, v] of Object.entries(src)) {
          if (
            k.toLowerCase() === lowerAlias &&
            v !== undefined &&
            v !== null &&
            String(v).trim() !== ""
          ) {
            return v;
          }
        }
      }
    }
    return undefined;
  };

  const loggedInAliases = [
    "DAILY_IMAGE_LIMIT_LOGGED_IN",
    "VITE_DAILY_IMAGE_LIMIT_LOGGED_IN",
    "DAILY_LIMIT_LOGGED_IN",
    "IMAGE_LIMIT_LOGGED_IN",
    "DAILY_IMAGE_LIMIT",
    "DAILY_LIMIT",
    "IMAGE_LIMIT",
    "DAILY_GENERATION_LIMIT",
    "GENERATION_LIMIT",
    "limitLoggedIn",
  ];

  const anonAliases = [
    "DAILY_IMAGE_LIMIT_ANON",
    "VITE_DAILY_IMAGE_LIMIT_ANON",
    "DAILY_LIMIT_ANON",
    "IMAGE_LIMIT_ANON",
    "DAILY_ANON_LIMIT",
    "ANON_LIMIT",
    "limitAnon",
  ];

  const warnAliases = [
    "DAILY_IMAGE_WARNING_THRESHOLD",
    "VITE_DAILY_IMAGE_WARNING_THRESHOLD",
    "DAILY_WARNING_THRESHOLD",
    "IMAGE_WARNING_THRESHOLD",
    "WARNING_THRESHOLD",
    "warningThreshold",
  ];

  const isServer = typeof window === "undefined";

  // 1. Server-side runtime environment variables (HIGHEST PRECEDENCE on server)
  if (isServer) {
    const globalRec = globalThis as Record<string, unknown>;
    const cfEnv = (globalRec["__env__"] ?? globalRec["__CLOUDFLARE_ENV__"]) as
      | Record<string, unknown>
      | undefined;
    const procEnv =
      typeof process !== "undefined" ? (process.env as Record<string, unknown>) : undefined;
    const serverSources = [cfEnv, procEnv];

    rawLoggedIn = readVar(serverSources, loggedInAliases);
    rawAnon = readVar(serverSources, anonAliases);
    rawWarn = readVar(serverSources, warnAliases);
  }

  // 2. Static compile-time replacement for Vite (used as initial client fallback or server fallback)
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const metaEnv = import.meta.env as Record<string, unknown>;
      rawLoggedIn = rawLoggedIn ?? metaEnv["VITE_DAILY_IMAGE_LIMIT_LOGGED_IN"];
      rawAnon = rawAnon ?? metaEnv["VITE_DAILY_IMAGE_LIMIT_ANON"];
      rawWarn = rawWarn ?? metaEnv["VITE_DAILY_IMAGE_WARNING_THRESHOLD"];
    }
  } catch {
    // import.meta not available
  }

  // 3. Fallback to process.env if client has process polyfill or was missed above
  try {
    if (typeof process !== "undefined" && process.env) {
      const pEnv = process.env as Record<string, unknown>;
      rawLoggedIn =
        rawLoggedIn ??
        pEnv["VITE_DAILY_IMAGE_LIMIT_LOGGED_IN"] ??
        pEnv["DAILY_IMAGE_LIMIT_LOGGED_IN"];
      rawAnon =
        rawAnon ?? pEnv["VITE_DAILY_IMAGE_LIMIT_ANON"] ?? pEnv["DAILY_IMAGE_LIMIT_ANON"];
      rawWarn =
        rawWarn ??
        pEnv["VITE_DAILY_IMAGE_WARNING_THRESHOLD"] ??
        pEnv["DAILY_IMAGE_WARNING_THRESHOLD"];
    }
  } catch {
    // process.env not available
  }

  return {
    limitLoggedIn: parseVal(rawLoggedIn, DEFAULT_DAILY_IMAGE_LIMIT_LOGGED_IN),
    limitAnon: parseVal(rawAnon, DEFAULT_DAILY_IMAGE_LIMIT_ANON),
    warningThreshold: parseVal(rawWarn, DEFAULT_DAILY_IMAGE_WARNING_THRESHOLD),
  };
}

/**
 * Formats milliseconds remaining into human-readable text (e.g. "23 hrs 45 mins", "42 mins").
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "soon";
  const totalMinutes = Math.ceil(ms / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} hr${hours > 1 ? "s" : ""} ${minutes} min${minutes > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours} hr${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} min${minutes > 1 ? "s" : ""}`;
}

export function getStorageKey(userId?: string | null): string {
  return userId ? `dearly_gen_limit_user_${userId}` : "dearly_gen_limit_anon";
}

/**
 * Filters out timestamps older than the 24-hour rolling window.
 */
export function pruneTimestamps(
  timestamps: number[],
  now = Date.now(),
  windowMs = GENERATION_WINDOW_MS,
): number[] {
  const threshold = now - windowMs;
  return timestamps
    .filter((t) => typeof t === "number" && Number.isFinite(t) && t > threshold)
    .sort((a, b) => a - b);
}

/**
 * Loads generation timestamps for a user from localStorage, automatically pruning expired ones.
 */
export function loadGenerationTimestamps(userId?: string | null, now = Date.now()): number[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (item): item is number => typeof item === "number" && Number.isFinite(item),
    );
    const active = pruneTimestamps(valid, now);
    if (active.length !== valid.length) {
      window.localStorage.setItem(getStorageKey(userId), JSON.stringify(active));
    }
    return active;
  } catch {
    return [];
  }
}

/**
 * Persists generation timestamps to localStorage and dispatches a broadcast event.
 */
export function saveGenerationTimestamps(
  userId: string | null | undefined,
  timestamps: number[],
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(timestamps));
    window.dispatchEvent(
      new CustomEvent("dearly_generation_updated", { detail: { userId: userId ?? null } }),
    );
  } catch {
    // private browsing or blocked storage
  }
}

/**
 * Returns current generation status including limit, remaining, countdown and warning state.
 */
export function getGenerationStatus(userId?: string | null, now = Date.now()): GenerationStatus {
  const config = getGenerationConfig();
  const isLoggedIn = Boolean(userId);
  const limit = isLoggedIn ? config.limitLoggedIn : config.limitAnon;
  const timestamps = loadGenerationTimestamps(userId, now);
  const count = timestamps.length;
  const remaining = Math.max(0, limit - count);
  const isAllowed = remaining > 0;
  const isLimitReached = remaining === 0;

  // For logged-in users, show warning after reaching warningThreshold (e.g. 5) up to limit (10)
  const shouldWarn = isLoggedIn && count >= config.warningThreshold && count < limit;

  let msUntilNextReset = 0;
  if (timestamps.length > 0 && typeof timestamps[0] === "number") {
    const oldest = timestamps[0];
    msUntilNextReset = Math.max(0, oldest + GENERATION_WINDOW_MS - now);
  }

  return {
    limit,
    limitLoggedIn: config.limitLoggedIn,
    limitAnon: config.limitAnon,
    count,
    remaining,
    isAllowed,
    shouldWarn,
    isLimitReached,
    isLoggedIn,
    msUntilNextReset,
    formattedResetTime: formatTimeRemaining(msUntilNextReset),
    warningThreshold: config.warningThreshold,
  };
}

/**
 * Records an image generation event for a user and broadcasts the update.
 */
export function recordGeneration(userId?: string | null, now = Date.now()): GenerationStatus {
  const current = loadGenerationTimestamps(userId, now);
  const updated = [...current, now];
  saveGenerationTimestamps(userId, updated);
  return getGenerationStatus(userId, now);
}

/**
 * Reactive React hook to track daily image generation status in components.
 */
export function useGenerationLimit(userId?: string | null) {
  const [status, setStatus] = useState<GenerationStatus>(() => getGenerationStatus(userId));

  useEffect(() => {
    const update = () => setStatus(getGenerationStatus(userId));
    update();

    if (typeof window === "undefined") {
      return undefined;
    }

    // Live sync from server on mount and when window regains focus
    syncGenerationConfig()
      .then(update)
      .catch(() => {});
    const onFocus = () => {
      syncGenerationConfig()
        .then(update)
        .catch(() => {});
    };

    window.addEventListener("dearly_generation_updated", update);
    window.addEventListener("storage", update);
    window.addEventListener("focus", onFocus);
    const timer = setInterval(update, 30000); // refresh every 30s for smooth countdown

    return () => {
      window.removeEventListener("dearly_generation_updated", update);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [userId]);

  return {
    status,
    record: () => recordGeneration(userId),
    refresh: () => {
      syncGenerationConfig()
        .then(() => setStatus(getGenerationStatus(userId)))
        .catch(() => {});
      setStatus(getGenerationStatus(userId));
    },
  };
}
