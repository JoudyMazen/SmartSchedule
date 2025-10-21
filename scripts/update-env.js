const fs = require('fs');
const path = require('path');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('Usage: node scripts/update-env.js your_email@gmail.com your_16_character_password');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env.local');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
} else {
  envContent = `# Environment Variables

# Database Configuration
DB_USER=postgres
DB_HOST=localhost
DB_NAME=smart_schedule
DB_PASSWORD=your_password_here
DB_PORT=5432

# JWT Secret for authentication
JWT_SECRET=your_super_secret_jwt_key_here

# Email Configuration (for password reset)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;
}

// Update email credentials
envContent = envContent.replace(/EMAIL_USER=.*/, `EMAIL_USER=${email}`);
envContent = envContent.replace(/EMAIL_PASS=.*/, `EMAIL_PASS=${password}`);

fs.writeFileSync(envPath, envContent);
console.log('✅ Email credentials updated successfully!');
console.log('Restart your development server: npm run dev');
