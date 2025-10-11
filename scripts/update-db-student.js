const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

async function updateDatabase() {
  try {
    console.log('Creating elective_preferences table...');
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS elective_preferences (
        preference_id SERIAL PRIMARY KEY,
        student_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
        level INT NOT NULL,
        course_code TEXT NOT NULL REFERENCES course(course_code) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, course_code)
      );
    `);

    console.log('✅ elective_preferences table created successfully!');
    
    // Create index for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_elective_preferences_student_id ON elective_preferences(student_id);
    `);
    
    console.log('✅ Index created successfully!');
    
  } catch (error) {
    console.error('❌ Error updating database:', error);
  } finally {
    await pool.end();
  }
}

updateDatabase();
