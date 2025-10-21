# Student Homepage - SmartSchedule

## Overview
A comprehensive student dashboard for the SmartSchedule system that allows students to view their schedules, provide feedback, and submit elective course preferences.

## Features

### 1. Schedule Viewing
- **Latest Schedule Display**: Shows the most recent schedule version for the logged-in student
- **Version Badge**: Displays "Latest v{version}" badge on the schedule header
- **Interactive Table**: Same table layout as Teaching Load Committee with time slots and days
- **Real-time Data**: Fetches schedule data from the database based on student's level and group
- **Search & Filter**: Advanced filtering by course, instructor, day, and search terms

### 2. Feedback System
- **Per-Row Feedback**: Each schedule entry has a "Feedback" button
- **Rating System**: 1-5 star rating system for schedule feedback
- **Detailed Comments**: Text area for comprehensive feedback
- **Feedback History**: View all previously submitted feedback
- **Real-time Submission**: Instant feedback submission with success/error notifications

### 3. Elective Course Preferences
- **Multi-Select Form**: Students can select multiple preferred elective courses
- **Student Information**: Name, ID, and level fields
- **Course Catalog**: Fetches all available elective courses from the database
- **Preference Management**: Submit new preferences or update existing ones
- **Success Toast**: Shows success notification when preferences are submitted

## Technical Implementation

### Database Schema
```sql
CREATE TABLE elective_preferences (
  preference_id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  level INT NOT NULL,
  course_code TEXT NOT NULL REFERENCES course(course_code) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, course_code)
);
```

### API Endpoints

#### Student Feedback API (`/api/student/feedback`)
- **GET**: Retrieve feedback for a specific user
- **POST**: Submit new feedback with rating and comments

#### Elective Preferences API (`/api/student/elective-preferences`)
- **GET**: Retrieve preferences for a student
- **POST**: Submit or update elective course preferences

### Components & Styling

#### Reused Components
- **Table Layout**: Exact same table structure as Teaching Load Committee
- **Modal Components**: Same feedback modal design and functionality
- **Styling**: Consistent color scheme and Bootstrap components
- **Icons**: Font Awesome icons for enhanced UX

#### RTL Support
- **Arabic Interface**: Full RTL (right-to-left) support
- **Arabic Labels**: All interface elements in Arabic
- **RTL Layout**: Proper RTL layout with `dir="rtl"` attribute

### Key Features

#### Schedule Display
```typescript
interface ScheduleEntry {
  schedule_id: number;
  section_num: number;
  course_code: string;
  course_name: string;
  time_slot: string;
  day: string;
  room: string;
  instructor: string;
  group_num: number;
  activity_type?: string;
  version?: number;
}
```

#### Feedback System
```typescript
interface Feedback {
  feedback_id?: number;
  schedule_id: number;
  user_id: number;
  comment: string;
  rating?: number;
  created_at?: string;
}
```

#### Elective Preferences
```typescript
interface ElectivePreference {
  studentId: number;
  level: number;
  electiveIds: string[];
}
```

## Usage Instructions

### For Students

1. **Viewing Schedule**:
   - Schedule automatically loads based on student's level and group
   - Use search and filter options to find specific information
   - Schedule displays in a weekly grid format with version badge

2. **Submitting Feedback**:
   - Click "Feedback" button on any schedule entry
   - Rate the schedule (1-5 stars)
   - Provide detailed comments
   - Submit for review by scheduling committee

3. **Elective Preferences**:
   - Click "تفضيلات المواد الاختيارية" button
   - Fill in name, student ID, and level
   - Select preferred elective courses from the multi-select dropdown
   - Submit preferences for future course planning

### For Administrators

1. **Database Setup**:
   ```bash
   node scripts/update-db-student.js
   ```

2. **Accessing Student Data**:
   - Student feedback is stored in `give_feedback` table
   - Elective preferences are stored in `elective_preferences` table
   - Both tables include user identification and timestamps

## Security Features

- **User Authentication**: Required for all operations
- **Role-based Access**: Student-specific functionality
- **Input Validation**: Comprehensive input validation and sanitization
- **SQL Injection Prevention**: Parameterized queries for all database operations

## RTL Implementation

### Arabic Interface Elements
- **Page Title**: "لوحة الطالب" (Student Dashboard)
- **Navigation**: Arabic labels for all buttons and forms
- **Form Labels**: All form fields in Arabic
- **Success Messages**: Toast notifications in Arabic
- **Modal Titles**: All modal headers in Arabic

### RTL Layout
- **Direction**: `dir="rtl"` attribute on main container
- **Text Alignment**: Right-aligned text for Arabic content
- **Form Layout**: RTL-friendly form layouts
- **Button Placement**: RTL-appropriate button positioning

## Future Enhancements

1. **Mobile Responsiveness**: Enhanced mobile experience
2. **Push Notifications**: Real-time schedule updates
3. **Advanced Analytics**: Student preference analytics
4. **Integration**: LMS integration for course materials
5. **Accessibility**: Enhanced accessibility features

## Troubleshooting

### Common Issues

1. **Schedule Not Loading**:
   - Check student authentication
   - Verify student has correct level/group assignment
   - Ensure schedule data exists for the student's parameters

2. **Feedback Not Submitting**:
   - Verify user authentication
   - Check required fields are filled
   - Ensure database connection is active

3. **Elective Preferences Not Saving**:
   - Check course codes exist in database
   - Verify all required fields are provided
   - Ensure student has proper permissions

### Database Maintenance

```sql
-- Check student preferences
SELECT * FROM elective_preferences ORDER BY created_at DESC;

-- Check student feedback
SELECT * FROM give_feedback WHERE user_id = ? ORDER BY created_at DESC;

-- Clean up old data (if needed)
DELETE FROM elective_preferences WHERE created_at < NOW() - INTERVAL '1 year';
```

## File Structure

```
pages/
├── studentHomePage.tsx          # Main student homepage component
└── api/student/
    ├── feedback.ts              # Student feedback API
    └── elective-preferences.ts  # Elective preferences API

scripts/
└── update-db-student.js         # Database update script

database/
└── schema.sql                  # Updated database schema
```

## Dependencies

- **React**: 18.x
- **Next.js**: 13.x
- **TypeScript**: 4.x
- **React-Bootstrap**: 2.x
- **Bootstrap Icons**: Latest
- **PostgreSQL**: 13.x+

## Browser Support

- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+
- **Mobile**: iOS 14+, Android 10+
