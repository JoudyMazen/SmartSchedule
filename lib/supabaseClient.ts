// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Use the public anon key (safe for browser) + URL from Supabase Settings → API
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);
