// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Use the public anon key (safe for browser) + URL from Supabase Settings → API
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
