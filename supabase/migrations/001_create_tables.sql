-- Supabase Migration: WhatsApp Session Persistence
-- Run this in your Supabase SQL Editor

-- Auth credentials for Baileys (replaces multi-file auth state)
CREATE TABLE IF NOT EXISTS wa_auth_keys (
  session_id TEXT NOT NULL,
  key_id TEXT NOT NULL,
  key_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, key_id)
);

-- Session metadata and configuration
CREATE TABLE IF NOT EXISTS wa_sessions (
  session_id TEXT PRIMARY KEY,
  phone_number TEXT,
  name TEXT,
  status TEXT DEFAULT 'disconnected',
  metadata JSONB DEFAULT '{}',
  webhooks JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store data (chats, contacts, messages cache)
CREATE TABLE IF NOT EXISTS wa_store (
  session_id TEXT PRIMARY KEY,
  store_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wa_auth_keys_session ON wa_auth_keys(session_id);
CREATE INDEX IF NOT EXISTS idx_wa_sessions_status ON wa_sessions(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers (drop first if exists to avoid errors)
DROP TRIGGER IF EXISTS wa_auth_keys_updated_at ON wa_auth_keys;
CREATE TRIGGER wa_auth_keys_updated_at
  BEFORE UPDATE ON wa_auth_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS wa_sessions_updated_at ON wa_sessions;
CREATE TRIGGER wa_sessions_updated_at
  BEFORE UPDATE ON wa_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS wa_store_updated_at ON wa_store;
CREATE TRIGGER wa_store_updated_at
  BEFORE UPDATE ON wa_store
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create storage bucket for media (run this separately in Storage settings or use SQL)
-- Note: Bucket creation via SQL requires superuser. Create manually in Supabase Dashboard:
-- 1. Go to Storage > New Bucket
-- 2. Name: chatery-media
-- 3. Public: false (private bucket)
