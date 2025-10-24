// const { Pool } = require('pg');
// const fs = require('fs');
// const path = require('path');

// // Load environment variables
// require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// // Database connection
// const pool = new Pool({
//   user: process.env.DB_USER || 'postgres',
//   host: process.env.DB_HOST || 'localhost',
//   database: process.env.DB_NAME || 'SmartSchedule',
//   password: process.env.DB_PASSWORD || 'password',
//   port: parseInt(process.env.DB_PORT || '5432'),
//   ssl: false
// });

// async function setupDatabase() {
//   try {
//     console.log('Setting up database...');
//     console.log('Connecting to:', {
//       user: process.env.DB_USER,
//       host: process.env.DB_HOST,
//       database: process.env.DB_NAME,
//       port: process.env.DB_PORT
//     });
    
//     // Read and execute schema
//     const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
//     const schema = fs.readFileSync(schemaPath, 'utf8');
    
//     await pool.query(schema);
//     console.log('✅ Database schema created successfully');
    
//     // Test connection
//     const result = await pool.query('SELECT NOW()');
//     console.log('✅ Database connection test successful:', result.rows[0].now);
    
//     console.log('\n🎉 Database setup completed!');
//     console.log('\nNext steps:');
//     console.log('1. Copy env.example to .env.local');
//     console.log('2. Update database credentials in .env.local');
//     console.log('3. Run: npm run dev');
    
//   } catch (error) {
//     console.error('❌ Database setup failed:', error.message);
//     process.exit(1);
//   } finally {
//     await pool.end();
//   }
// }

// setupDatabase();


// scripts/setup-db.js
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DATABASE_URL in environment.');
  process.exit(1);
}

const pool = new Pool({ connectionString: url }); // internal URL: no SSL needed

async function main() {
  const schemaPath = path.join(process.cwd(), 'schema.sql'); // adjust if needed
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('Applying schema to DB...');
  await pool.query(sql);
  console.log('Schema applied successfully.');
  await pool.end();
}

main().catch(err => {
  console.error('❌ Database setup failed:', err.message);
  process.exit(1);
});
