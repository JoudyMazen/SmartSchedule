// lib/db-supabase.ts
// Alternative approach using Supabase client library
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Query wrapper to maintain compatibility with pg pool
export const query = async (text: string, params?: any[]) => {
  console.log('⚠️ Using Supabase client instead of direct PostgreSQL connection');
  
  // This is a simplified adapter - you'll need to modify based on your queries
  // Supabase uses different syntax than raw SQL with parameterized queries
  
  throw new Error('Please use Supabase client methods directly or fix PostgreSQL connection');
};

// Test connection
export const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('user')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error);
    return false;
  }
};

export default supabase;