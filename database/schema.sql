-- Smart Schedule Database Schema
-- This file contains the complete database schema for the Smart Schedule System

-- ========== ENTITIES ========================

CREATE TABLE "user" (
  user_id   SERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT NOT NULL UNIQUE,
  phone     TEXT,
  password  TEXT NOT NULL,
  role      TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student (
  student_id   SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  is_irregular BOOLEAN DEFAULT FALSE,
  level        INT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Irregular_Student_Data (
  user_id           INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  student_id        INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  remaining_courses TEXT,
  needed_courses    TEXT,
  PRIMARY KEY (user_id, student_id)
);

CREATE TABLE course (
  course_code  TEXT PRIMARY KEY,
  course_name  TEXT NOT NULL,
  is_elective  BOOLEAN DEFAULT FALSE,
  lecture      BOOLEAN DEFAULT TRUE,
  tutorial     BOOLEAN DEFAULT FALSE,
  lab          BOOLEAN DEFAULT FALSE,
  level        INT,
  credits      INT DEFAULT 3
);

CREATE TABLE section (
  section_num INT PRIMARY KEY,
  capacity    INT DEFAULT 25
);

CREATE TABLE schedule (
  schedule_id SERIAL PRIMARY KEY,
  level_num   INT NOT NULL,
  group_num   INT DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE CoursePreference (
  CoursePreference_id SERIAL PRIMARY KEY,
  student_id          INT REFERENCES student(student_id) ON DELETE CASCADE,
  current_level       INT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Exam (
  exam_id SERIAL PRIMARY KEY,
  exam_type TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Exam_Mid_final (
  exam_id INT PRIMARY KEY REFERENCES Exam(exam_id) ON DELETE CASCADE,
  date    DATE NOT NULL,
  time    TIME NOT NULL,
  duration INT DEFAULT 120 -- minutes
);

CREATE TABLE Rule (
  rule_id     SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  rule_type   TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Comment (
  comment_id SERIAL PRIMARY KEY,
  content    TEXT NOT NULL,
  user_id    INT REFERENCES "user"(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== RELATIONSHIPS ===================

CREATE TABLE Contain (
  schedule_id INT NOT NULL REFERENCES schedule(schedule_id) ON DELETE CASCADE,
  section_num INT NOT NULL REFERENCES section(section_num) ON DELETE CASCADE,
  course_code TEXT REFERENCES course(course_code) ON DELETE SET NULL,
  time_slot   TEXT NOT NULL,
  day         TEXT NOT NULL,
  room        TEXT,
  instructor  TEXT,
  PRIMARY KEY (schedule_id, section_num, time_slot, day)
);

CREATE TABLE give_feedback (
  user_id     INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  schedule_id INT NOT NULL REFERENCES schedule(schedule_id) ON DELETE CASCADE,
  comment     TEXT,
  rating      INT CHECK (rating >= 1 AND rating <= 5),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, schedule_id)
);

CREATE TABLE give_comment (
  student_id INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  exam_id    INT NOT NULL REFERENCES Exam(exam_id) ON DELETE CASCADE,
  comment    TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id, exam_id)
);

CREATE TABLE has (
  student_id INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  exam_id    INT NOT NULL REFERENCES Exam(exam_id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, exam_id)
);

CREATE TABLE CoursePreference_priority (
  CoursePreference_id INT NOT NULL REFERENCES CoursePreference(CoursePreference_id) ON DELETE CASCADE,
  course_code         TEXT NOT NULL REFERENCES course(course_code) ON DELETE CASCADE,
  priority            INT NOT NULL,
  PRIMARY KEY (CoursePreference_id, course_code)
);

CREATE TABLE Edited_by (
  user_id INT NOT NULL REFERENCES "user"(user_id) ON DELETE CASCADE,
  rule_id INT NOT NULL REFERENCES Rule(rule_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, rule_id)
);

-- ========== INDEXES ========================

CREATE INDEX idx_user_email ON "user"(email);
CREATE INDEX idx_user_role ON "user"(role);
CREATE INDEX idx_student_user_id ON student(user_id);
CREATE INDEX idx_schedule_level ON schedule(level_num);
CREATE INDEX idx_schedule_status ON schedule(status);
CREATE INDEX idx_contain_schedule ON Contain(schedule_id);
CREATE INDEX idx_course_level ON course(level);
CREATE INDEX idx_course_elective ON course(is_elective);

-- ========== SAMPLE DATA ====================

-- Insert sample users
INSERT INTO "user" (name, email, phone, password, role) VALUES
('Admin User', 'admin@university.edu', '1234567890', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2C', 'scheduling_committee'),
('John Student', 'john@student.edu', '1234567891', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2C', 'student'),
('Jane Faculty', 'jane@faculty.edu', '1234567892', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2C', 'faculty');

-- Insert sample student
INSERT INTO student (user_id, is_irregular, level) VALUES
(2, FALSE, 3);

-- Insert sample courses
INSERT INTO course (course_code, course_name, is_elective, lecture, tutorial, lab, level, credits) VALUES
('CSC101', 'Introduction to Computer Science', FALSE, TRUE, TRUE, TRUE, 3, 4),
('MATH101', 'Calculus I', FALSE, TRUE, TRUE, FALSE, 3, 3),
('PHYS101', 'Physics I', FALSE, TRUE, TRUE, TRUE, 3, 4),
('ENG101', 'English Composition', FALSE, TRUE, FALSE, FALSE, 3, 3),
('CSC201', 'Data Structures', FALSE, TRUE, TRUE, TRUE, 4, 4),
('MATH201', 'Calculus II', FALSE, TRUE, TRUE, FALSE, 4, 3),
('CSC301', 'Algorithms', FALSE, TRUE, TRUE, FALSE, 5, 3),
('CSC401', 'Software Engineering', FALSE, TRUE, TRUE, TRUE, 6, 4),
('CSC501', 'Database Systems', FALSE, TRUE, TRUE, FALSE, 7, 3),
('CSC601', 'Machine Learning', TRUE, TRUE, TRUE, FALSE, 8, 3);

-- Insert sample sections
INSERT INTO section (section_num, capacity) VALUES
(1, 25),
(2, 25),
(3, 25),
(4, 25),
(5, 25);

-- Insert sample rules
INSERT INTO Rule (description, rule_type, is_active) VALUES
('Maximum 6 hours per day per student', 'student_constraint', TRUE),
('Minimum 1 hour break between classes', 'time_constraint', TRUE),
('Lab sessions must be scheduled in afternoon', 'lab_constraint', TRUE),
('Maximum 3 courses per day per student', 'course_constraint', TRUE);

-- Note: Password hash above is for 'password123' - change in production!
