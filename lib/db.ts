import { Pool } from 'pg';

// const pool = new Pool({
//   connectionString: process.env.SUPABASE_URL?.replace('https://', 'postgresql://postgres:') + ':5432/postgres',
//   ssl: {
//     rejectUnauthorized: false
//   }
// });

// Alternative direct connection (use this if above doesn't work)
// const pool = new Pool({
//   host: 'db.oybqhgyerzfvonftolpm.supabase.co',
//   port: 5432,
//   database: 'postgres',
//   user: 'postgres',
//   password: 'YOUR_DATABASE_PASSWORD', // You'll need to get this from Supabase
//   ssl: {
//     rejectUnauthorized: false
//   }
// });
const pool = new Pool({
    connectionString: 'postgresql://postgres:SmartWeb123%40@db.oybqhgyerzfvonftolpm.supabase.co:5432/postgres',
    ssl: {
      rejectUnauthorized: false
    }
  });

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set a timeout of 5 seconds
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
  }, 5000);
  
  client.release = () => {
    clearTimeout(timeout);
    client.removeAllListeners();
    release();
  };
  
  return client;
};

export default pool;