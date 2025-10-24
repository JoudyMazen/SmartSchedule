import { Pool } from 'pg';

// Method 1: Use DATABASE_URL if available (better for special characters in password)
// Method 2: Fallback to individual env variables
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 5432,
        ssl: {
          rejectUnauthorized: false
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      }
);

// Log connection attempt (without showing password)
console.log('🔄 Initializing database connection...');
console.log('Using connection method:', process.env.DATABASE_URL ? 'CONNECTION_URL' : 'ENV_VARIABLES');
console.log('Host:', process.env.DB_HOST || 'from DATABASE_URL');

// Test the connection on startup
pool.on('connect', (client) => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected database error:', err.message);

});

// Query helper with error logging
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('✅ Query executed', { duration, rows: res.rowCount });
    return res;
  } catch (error: any) {
    console.error('❌ Database query error:', {
      message: error.message,
      code: error.code,
      query: text.substring(0, 100)
    });
    throw error;
  }
};

// Get a client from the pool for transactions
export const getClient = async () => {
  try {
    const client = await pool.connect();
    const query = client.query.bind(client);
    const release = client.release.bind(client);
    
    // Set a timeout of 5 seconds
    const timeout = setTimeout(() => {
      console.error('⚠️  A client has been checked out for more than 5 seconds!');
    }, 5000);
    
    client.release = () => {
      clearTimeout(timeout);
      client.removeAllListeners();
      release();
    };
    
    return client;
  } catch (error: any) {
    console.error('❌ Failed to get database client:', error.message);
    throw error;
  }
};

// Test database connection function
export const testConnection = async () => {
  try {
    console.log('🔍 Testing database connection...');
    const result = await pool.query('SELECT NOW() as current_time, version() as db_version');
    console.log('✅ Database connection test successful!');
    console.log('📅 Server time:', result.rows[0].current_time);
    console.log('🗄️  Database:', result.rows[0].db_version.substring(0, 50) + '...');
    return true;
  } catch (error: any) {
    console.error('❌ Database connection test failed!');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    
    // Provide helpful error messages
    if (error.code === 'ENOTFOUND') {
      console.error('💡 Possible fixes:');
      console.error('   1. Check if Supabase project is paused (resume it in dashboard)');
      console.error('   2. Verify the hostname is correct');
      console.error('   3. Check your internet connection');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 Connection refused - check if database is running');
    } else if (error.code === '28P01') {
      console.error('💡 Authentication failed - check your password');
    }
    
    return false;
  }
};

export default pool;