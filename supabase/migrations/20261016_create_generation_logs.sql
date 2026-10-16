-- Supabase Migration: 20261016_create_generation_logs.sql
-- Persistent rolling 24-hour image generation rate limiting for Dearly Studio

-- 1. Create generation_logs table
CREATE TABLE IF NOT EXISTS public.generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_hash TEXT NOT NULL,
  is_logged_in BOOLEAN NOT NULL DEFAULT FALSE,
  style TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create optimized indexes for rolling 24-hour window queries
CREATE INDEX IF NOT EXISTS idx_gen_logs_user_window 
  ON public.generation_logs (user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gen_logs_guest_window 
  ON public.generation_logs (client_hash, created_at DESC) 
  WHERE user_id IS NULL;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view only their own logs
DROP POLICY IF EXISTS "Users can read their own generation logs" ON public.generation_logs;
CREATE POLICY "Users can read their own generation logs"
  ON public.generation_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Create atomic check & record RPC function (SECURITY DEFINER runs with creator privileges)
CREATE OR REPLACE FUNCTION public.check_and_record_generation(
  p_user_id UUID DEFAULT NULL,
  p_client_hash TEXT DEFAULT '',
  p_limit INT DEFAULT 10,
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
BEGIN
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

  v_allowed := (v_count < p_limit);
  v_remaining := GREATEST(0, p_limit - v_count);

  IF v_oldest_timestamp IS NOT NULL THEN
    v_reset_ms := GREATEST(0, EXTRACT(EPOCH FROM (v_oldest_timestamp + (p_window_hours || ' hours')::interval - now()))::bigint * 1000);
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'count', v_count,
      'remaining', 0,
      'limit', p_limit,
      'oldest_timestamp', v_oldest_timestamp,
      'reset_ms', v_reset_ms
    );
  END IF;

  -- Record the new generation
  INSERT INTO public.generation_logs (user_id, client_hash, is_logged_in, style)
  VALUES (p_user_id, p_client_hash, (p_user_id IS NOT NULL), p_style);

  v_count := v_count + 1;
  v_remaining := GREATEST(0, p_limit - v_count);
  IF v_oldest_timestamp IS NULL THEN
    v_oldest_timestamp := now();
    v_reset_ms := (p_window_hours * 3600 * 1000)::bigint;
  END IF;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'count', v_count,
    'remaining', v_remaining,
    'limit', p_limit,
    'oldest_timestamp', v_oldest_timestamp,
    'reset_ms', v_reset_ms
  );
END;
$$;

-- 5. Create read-only status RPC function (does not increment count)
CREATE OR REPLACE FUNCTION public.get_generation_status(
  p_user_id UUID DEFAULT NULL,
  p_client_hash TEXT DEFAULT '',
  p_limit INT DEFAULT 10,
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
BEGIN
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
    'remaining', GREATEST(0, p_limit - v_count),
    'limit', p_limit,
    'allowed', (v_count < p_limit),
    'oldest_timestamp', v_oldest_timestamp,
    'reset_ms', v_reset_ms
  );
END;
$$;

-- 6. Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.check_and_record_generation TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_generation_status TO anon, authenticated, service_role;
