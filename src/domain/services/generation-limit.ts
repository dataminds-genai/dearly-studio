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

/**
 * Reads daily generation limits from environment variables with robust fallbacks.
 * Checks both import.meta.env (client/Vite) and process.env (server/Node).
 */
export function getGenerationConfig(): GenerationConfig {
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

  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      rawLoggedIn =
        import.meta.env["VITE_DAILY_IMAGE_LIMIT_LOGGED_IN"] ??
        import.meta.env["DAILY_IMAGE_LIMIT_LOGGED_IN"];
      rawAnon =
        import.meta.env["VITE_DAILY_IMAGE_LIMIT_ANON"] ??
        import.meta.env["DAILY_IMAGE_LIMIT_ANON"];
      rawWarn =
        import.meta.env["VITE_DAILY_IMAGE_WARNING_THRESHOLD"] ??
        import.meta.env["DAILY_IMAGE_WARNING_THRESHOLD"];
    }
  } catch {
    // import.meta not available
  }

  try {
    if (typeof process !== "undefined" && process.env) {
      rawLoggedIn =
        rawLoggedIn ??
        process.env["VITE_DAILY_IMAGE_LIMIT_LOGGED_IN"] ??
        process.env["DAILY_IMAGE_LIMIT_LOGGED_IN"];
      rawAnon =
        rawAnon ??
        process.env["VITE_DAILY_IMAGE_LIMIT_ANON"] ??
        process.env["DAILY_IMAGE_LIMIT_ANON"];
      rawWarn =
        rawWarn ??
        process.env["VITE_DAILY_IMAGE_WARNING_THRESHOLD"] ??
        process.env["DAILY_IMAGE_WARNING_THRESHOLD"];
    }
  } catch {
    // process not available
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

    window.addEventListener("dearly_generation_updated", update);
    window.addEventListener("storage", update);
    const timer = setInterval(update, 30000); // refresh every 30s for smooth countdown

    return () => {
      window.removeEventListener("dearly_generation_updated", update);
      window.removeEventListener("storage", update);
      clearInterval(timer);
    };
  }, [userId]);

  return {
    status,
    record: () => recordGeneration(userId),
    refresh: () => setStatus(getGenerationStatus(userId)),
  };
}
