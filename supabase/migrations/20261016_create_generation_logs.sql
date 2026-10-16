-- Supabase Migration: 20261016_create_generation_logs.sql
-- Persistent rolling 24-hour image generation rate limiting and dynamic app configuration for Dearly Studio

-- 1. Create app_config table for dynamic system-wide configuration
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default generation limits: guest=3, registered=15, warning_threshold=7
INSERT INTO public.app_config (key, value, description)
VALUES (
  'generation_limits',
  jsonb_build_object(
    'guest', 3,
    'registered', 15,
    'warning_threshold', 7
  ),
  'Daily rolling 24-hour image generation limits per user tier'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

-- Enable RLS on app_config
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated clients to read configuration
DROP POLICY IF EXISTS "Public can read app_config" ON public.app_config;
CREATE POLICY "Public can read app_config"
  ON public.app_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow service role full control over app_config
DROP POLICY IF EXISTS "Service role can modify app_config" ON public.app_config;
CREATE POLICY "Service role can modify app_config"
  ON public.app_config
  FOR ALL
  TO service_role
  USING (true);

-- 2. Create generation_logs table
CREATE TABLE IF NOT EXISTS public.generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_hash TEXT NOT NULL,
  is_logged_in BOOLEAN NOT NULL DEFAULT FALSE,
  style TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create optimized indexes for rolling 24-hour window queries
CREATE INDEX IF NOT EXISTS idx_gen_logs_user_window 
  ON public.generation_logs (user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gen_logs_guest_window 
  ON public.generation_logs (client_hash, created_at DESC) 
  WHERE user_id IS NULL;

-- 4. Enable Row Level Security (RLS) on generation_logs
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only their own logs
DROP POLICY IF EXISTS "Users can read their own generation logs" ON public.generation_logs;
CREATE POLICY "Users can read their own generation logs"
  ON public.generation_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Create atomic check & record RPC function (SECURITY DEFINER runs with creator privileges)
CREATE OR REPLACE FUNCTION public.check_and_record_generation(
  p_user_id UUID DEFAULT NULL,
  p_client_hash TEXT DEFAULT '',
  p_limit INT DEFAULT NULL,
  p_window_hours INT DEFAULT 24,
  p_style TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_oldest_timestamp TIMESTAMPTZ;
  v_threshold TIMESTAMPTZ := now() - (p_window_hours || ' hours')::interval;
  v_allowed BOOLEAN;
  v_remaining INT;
  v_reset_ms BIGINT := 0;
  v_effective_limit INT := p_limit;
BEGIN
  -- Resolve effective limit from app_config if p_limit is omitted or <= 0
  IF v_effective_limit IS NULL OR v_effective_limit <= 0 THEN
    SELECT
      CASE
        WHEN p_user_id IS NOT NULL THEN COALESCE((value->>'registered')::int, 15)
        ELSE COALESCE((value->>'guest')::int, 3)
      END
    INTO v_effective_limit
    FROM public.app_config
    WHERE key = 'generation_limits';

    IF v_effective_limit IS NULL THEN
      v_effective_limit := CASE WHEN p_user_id IS NOT NULL THEN 15 ELSE 3 END;
    END IF;
  END IF;

  -- Count active generations in the rolling window
  IF p_user_id IS NOT NULL THEN
    SELECT count(*), min(created_at)
    INTO v_count, v_oldest_timestamp
    FROM public.generation_logs
    WHERE user_id = p_user_id AND created_at > v_threshold;
  ELSE
    SELECT count(*), min(created_at)
    INTO v_count, v_oldest_timestamp
    FROM public.generation_logs
    WHERE client_hash = p_client_hash AND user_id IS NULL AND created_at > v_threshold;
  END IF;

  v_allowed := (v_count < v_effective_limit);
  v_remaining := GREATEST(0, v_effective_limit - v_count);

  IF v_oldest_timestamp IS NOT NULL THEN
    v_reset_ms := GREATEST(0, EXTRACT(EPOCH FROM (v_oldest_timestamp + (p_window_hours || ' hours')::interval - now()))::bigint * 1000);
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'count', v_count,
      'remaining', 0,
      'limit', v_effective_limit,
      'oldest_timestamp', v_oldest_timestamp,
      'reset_ms', v_reset_ms
    );
  END IF;

  -- Record the new generation
  INSERT INTO public.generation_logs (user_id, client_hash, is_logged_in, style)
  VALUES (p_user_id, p_client_hash, (p_user_id IS NOT NULL), p_style);

  v_count := v_count + 1;
  v_remaining := GREATEST(0, v_effective_limit - v_count);
  IF v_oldest_timestamp IS NULL THEN
    v_oldest_timestamp := now();
    v_reset_ms := (p_window_hours * 3600 * 1000)::bigint;
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'count', v_count,
    'remaining', v_remaining,
    'limit', v_effective_limit,
    'oldest_timestamp', v_oldest_timestamp,
    'reset_ms', v_reset_ms
  );
END;
$$;

-- 6. Create read-only status RPC function (does not increment count)
CREATE OR REPLACE FUNCTION public.get_generation_status(
  p_user_id UUID DEFAULT NULL,
  p_client_hash TEXT DEFAULT '',
  p_limit INT DEFAULT NULL,
  p_window_hours INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_oldest_timestamp TIMESTAMPTZ;
  v_threshold TIMESTAMPTZ := now() - (p_window_hours || ' hours')::interval;
  v_reset_ms BIGINT := 0;
  v_effective_limit INT := p_limit;
BEGIN
  -- Resolve effective limit from app_config if p_limit is omitted or <= 0
  IF v_effective_limit IS NULL OR v_effective_limit <= 0 THEN
    SELECT
      CASE
        WHEN p_user_id IS NOT NULL THEN COALESCE((value->>'registered')::int, 15)
        ELSE COALESCE((value->>'guest')::int, 3)
      END
    INTO v_effective_limit
    FROM public.app_config
    WHERE key = 'generation_limits';

    IF v_effective_limit IS NULL THEN
      v_effective_limit := CASE WHEN p_user_id IS NOT NULL THEN 15 ELSE 3 END;
    END IF;
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT count(*), min(created_at)
    INTO v_count, v_oldest_timestamp
    FROM public.generation_logs
    WHERE user_id = p_user_id AND created_at > v_threshold;
  ELSE
    SELECT count(*), min(created_at)
    INTO v_count, v_oldest_timestamp
    FROM public.generation_logs
    WHERE client_hash = p_client_hash AND user_id IS NULL AND created_at > v_threshold;
  END IF;

  IF v_oldest_timestamp IS NOT NULL THEN
    v_reset_ms := GREATEST(0, EXTRACT(EPOCH FROM (v_oldest_timestamp + (p_window_hours || ' hours')::interval - now()))::bigint * 1000);
  END IF;

  RETURN jsonb_build_object(
    'count', v_count,
    'remaining', GREATEST(0, v_effective_limit - v_count),
    'limit', v_effective_limit,
    'allowed', (v_count < v_effective_limit),
    'oldest_timestamp', v_oldest_timestamp,
    'reset_ms', v_reset_ms
  );
END;
$$;

-- 7. Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.check_and_record_generation TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_generation_status TO anon, authenticated, service_role;
