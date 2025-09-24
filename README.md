# Smart Schedule Website

A comprehensive academic scheduling system built with Next.js, PostgreSQL, and AI-powered schedule generation.

## Features

### Core Features (Phase 1)

- **User Authentication**: Sign up, login, and logout for all user roles
- **Role-based Access**: Students, Faculty, Scheduling Committee, Teaching Load Committee
- **AI Schedule Generation**: Automated schedule creation for levels 3-8
- **Schedule Management**: Create, view, and manage academic schedules
- **Version Control**: Save and track all previous schedule versions

### User Roles

- **Students**: View schedules, submit feedback
- **Faculty**: View teaching schedules, provide feedback
- **Scheduling Committee**: Generate AI schedules, manage all schedules
- **Teaching Load Committee**: Review and provide feedback on schedules

## Technology Stack

- **Frontend**: Next.js 14, React 18, Bootstrap 5
- **Backend**: Next.js API Routes, Express.js patterns
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT tokens with bcrypt password hashing
- **AI Integration**: Custom AI logic for schedule generation
- **Real-time**: Y.js for collaborative features
- **Version Control**: JsonDiffPatch for change tracking
- **Visualization**: Chart.js for dashboards

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   # Create .env.local file
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=smart_schedule
   DB_PASSWORD=your_password
   DB_PORT=5432
   JWT_SECRET=your_jwt_secret
   ```

4. Set up the database:

   ```sql
   -- Run the provided SQL schema to create tables
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Schema

The application uses a PostgreSQL database with the following key tables:

- `user`: User accounts with roles
- `student`: Student-specific data
- `course`: Course information
- `section`: Section details
- `schedule`: Schedule instances
- `Contain`: Schedule slots (time, day, course assignments)
- `Rule`: Scheduling rules
- `Exam`: Exam information

## API Endpoints

### Authentication

- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login

### Schedules

- `GET /api/schedules` - Get all schedules or by level
- `POST /api/schedules` - Create new schedule (with AI generation)
- `GET /api/schedules/[id]` - Get specific schedule details
- `PUT /api/schedules/[id]` - Update schedule status

## AI Schedule Generation

The system includes intelligent schedule generation that:

- Distributes courses across time slots and days
- Considers course types (lecture, tutorial, lab)
- Respects section capacities
- Generates schedules for levels 3-8
- Maintains version history

## Project Structure

```
├── lib/
│   ├── auth.ts          # Authentication utilities
│   ├── database.ts      # Database connection
│   └── schedule.ts      # Schedule management
├── pages/
│   ├── api/
│   │   ├── auth/        # Authentication endpoints
│   │   └── schedules/    # Schedule endpoints
│   ├── index.tsx         # Main dashboard
│   └── schedule.tsx      # Schedule view page
└── package.json
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
