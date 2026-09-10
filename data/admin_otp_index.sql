-- OTP records use the existing Supabase app_data JSONB store.
-- No separate OTP table is required; each OTP is stored as collection='adminOtps'.
-- This index keeps the server-side OTP/rate-limit lookups efficient without changing existing data.

CREATE INDEX IF NOT EXISTS idx_app_data_admin_otps
ON public.app_data (collection, updated_at DESC)
WHERE collection = 'adminOtps';
