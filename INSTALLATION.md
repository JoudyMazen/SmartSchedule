# Smart Schedule Website - Installation Guide

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **PostgreSQL** (version 12 or higher)
- **npm** or **yarn** package manager

## Installation Steps

### 1. Clone and Install Dependencies

```bash
# Navigate to your project directory
cd web1

# Install all dependencies
npm install
```

### 2. Database Setup

#### Option A: Using the Setup Script (Recommended)

1. **Create Environment File**:

   ```bash
   # Copy the example environment file
   cp env.example .env.local
   ```

2. **Update Database Credentials**:
   Edit `.env.local` and update the database connection details:

   ```env
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=smart_schedule
   DB_PASSWORD=your_actual_password
   DB_PORT=5432
   JWT_SECRET=your_super_secret_jwt_key_here
   ```

3. **Run Database Setup**:
   ```bash
   npm run setup-db
   ```

#### Option B: Manual Database Setup

1. **Create Database**:

   ```sql
   CREATE DATABASE smart_schedule;
   ```

2. **Run Schema**:
   ```bash
   psql -U postgres -d smart_schedule -f database/schema.sql
   ```

### 3. Start the Application

```bash
# Start the development server
npm run dev
```

The application will be available at: **http://localhost:3000**

## Default Login Credentials

After running the database setup, you can use these default accounts:

### Scheduling Committee (Admin)

- **Email**: admin@university.edu
- **Password**: password123
- **Role**: scheduling_committee

### Student

- **Email**: john@student.edu
- **Password**: password123
- **Role**: student

### Faculty

- **Email**: jane@faculty.edu
- **Password**: password123
- **Role**: faculty

## Features Overview

### Core Features Implemented

1. **User Authentication**

   - Sign up with role selection
   - Login with email/password
   - JWT-based session management
   - Logout functionality

2. **Role-Based Access**

   - **Scheduling Committee**: Generate AI schedules, manage all schedules
   - **Students/Faculty**: View schedules, submit feedback

3. **AI Schedule Generation**

   - Generate schedules for levels 3-8
   - Intelligent course distribution
   - Version control and history

4. **Schedule Management**
   - Grid-based schedule display
   - Color-coded course types
   - Schedule statistics and overview

### User Interface

- **Professional Design**: Blue and white color scheme
- **Responsive Layout**: Works on desktop and mobile
- **Bootstrap Components**: Modern, accessible UI
- **Interactive Elements**: Easy navigation and actions

## Project Structure

```
├── components/
│   └── ScheduleView.tsx      # Schedule grid display
├── lib/
│   ├── auth.ts              # Authentication utilities
│   ├── database.ts          # Database connection
│   └── schedule.ts          # Schedule management
├── pages/
│   ├── api/
│   │   ├── auth/            # Authentication endpoints
│   │   ├── schedules/        # Schedule endpoints
│   │   └── courses/         # Course endpoints
│   ├── index.tsx            # Main dashboard
│   └── schedule.tsx         # Schedule view page
├── database/
│   └── schema.sql           # Database schema
├── scripts/
│   └── setup-db.js          # Database setup script
└── package.json
```

## API Endpoints

### Authentication

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login

### Schedules

- `GET /api/schedules` - Get all schedules or by level
- `POST /api/schedules` - Create new schedule (with AI generation)
- `GET /api/schedules/[id]` - Get specific schedule details
- `GET /api/schedules/[id]/view` - Get schedule in grid format
- `PUT /api/schedules/[id]` - Update schedule status

### Courses

- `GET /api/courses` - Get all courses and sections

## Troubleshooting

### Common Issues

1. **Database Connection Error**

   - Verify PostgreSQL is running
   - Check database credentials in `.env.local`
   - Ensure database exists

2. **Port Already in Use**

   - Change port in `package.json` scripts
   - Or kill the process using port 3000

3. **Module Not Found**
   - Run `npm install` again
   - Clear `node_modules` and reinstall

### Getting Help

If you encounter issues:

1. Check the console for error messages
2. Verify all environment variables are set
3. Ensure database schema is properly created
4. Check that all dependencies are installed

## Next Steps

After successful installation:

1. **Test the Application**: Login with default credentials
2. **Generate Schedules**: Use the AI generation feature
3. **View Schedules**: Click "View" to see the grid format
4. **Customize**: Modify the AI logic in `lib/schedule.ts`

## Development

To continue development:

```bash
# Install additional dependencies as needed
npm install package-name

# Run linting
npm run lint

# Build for production
npm run build
```

## Production Deployment

For production deployment:

1. Set up a production PostgreSQL database
2. Update environment variables
3. Run `npm run build`
4. Deploy to your hosting platform (e.g., Vercel, Netlify)

---

**Note**: This is Phase 1 implementation focusing on core features. Additional features like real-time collaboration, advanced AI, and comprehensive reporting will be added in future phases.
