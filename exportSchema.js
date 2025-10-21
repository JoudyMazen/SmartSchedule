const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'db.oybqhgyerzfvonftolpm.supabase.co',
  database: 'postgres',
  password: 'SmartWeb123@',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function exportSchema() {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log('=== DATABASE TABLES ===\n');
    
    for (const { table_name } of tables.rows) {
      console.log(`\n--- ${table_name} ---`);
      
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [table_name]);
      
      columns.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

exportSchema();