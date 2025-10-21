import pool from './db';

export interface Schedule {
  schedule_id: number;
  level_num: number;
  group_num: number;
  status: string;
  created_at?: Date;
}

export interface ScheduleSlot {
  schedule_id: number;
  section_num: number;
  time_slot: string;
  day: string;
  course_code?: string;
  course_name?: string;
}

export interface Course {
  course_code: string;
  course_name: string;
  is_elective: boolean;
  lecture: boolean;
  tutorial: boolean;
  lab: boolean;
}

export interface Section {
  section_num: number;
  capacity: number;
}

export async function createSchedule(level_num: number, group_num: number): Promise<Schedule> {
  const result = await pool.query(
    'INSERT INTO schedule (level_num, group_num, status) VALUES ($1, $2, $3) RETURNING *',
    [level_num, group_num, 'draft']
  );
  return result.rows[0];
}

export async function getSchedulesByLevel(level_num: number): Promise<Schedule[]> {
  const result = await pool.query(
    'SELECT * FROM schedule WHERE level_num = $1 ORDER BY created_at DESC',
    [level_num]
  );
  return result.rows;
}

export async function getAllSchedules(): Promise<Schedule[]> {
  const result = await pool.query(
    'SELECT * FROM schedule ORDER BY level_num, created_at DESC'
  );
  return result.rows;
}

export async function getScheduleWithSlots(schedule_id: number): Promise<ScheduleSlot[]> {
  const result = await pool.query(`
    SELECT c.schedule_id, c.section_num, c.time_slot, c.day, 
           co.course_code, co.course_name
    FROM Contain c
    LEFT JOIN course co ON c.course_code = co.course_code
    WHERE c.schedule_id = $1
    ORDER BY c.day, c.time_slot
  `, [schedule_id]);
  return result.rows;
}

export async function addScheduleSlot(
  schedule_id: number,
  section_num: number,
  time_slot: string,
  day: string,
  course_code?: string
): Promise<void> {
  await pool.query(
    'INSERT INTO Contain (schedule_id, section_num, time_slot, day, course_code) VALUES ($1, $2, $3, $4, $5)',
    [schedule_id, section_num, time_slot, day, course_code]
  );
}

export async function getCourses(): Promise<Course[]> {
  const result = await pool.query('SELECT * FROM course ORDER BY course_code');
  return result.rows;
}

export async function getSections(): Promise<Section[]> {
  const result = await pool.query('SELECT * FROM section ORDER BY section_num');
  return result.rows;
}

export async function updateScheduleStatus(schedule_id: number, status: string): Promise<void> {
  await pool.query(
    'UPDATE schedule SET status = $1 WHERE schedule_id = $2',
    [status, schedule_id]
  );
}

// AI Schedule Generation Logic
export function generateAISchedule(level: number, courses: Course[], sections: Section[]): ScheduleSlot[] {
  const timeSlots = ['8-9', '9-10', '10-11', '11-12', '12-1', '1-2', '2-3', '3-4'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const scheduleSlots: ScheduleSlot[] = [];

  // Simple AI logic: distribute courses across time slots and days
  let courseIndex = 0;
  let sectionIndex = 0;

  for (const day of days) {
    for (const timeSlot of timeSlots) {
      if (courseIndex < courses.length && sectionIndex < sections.length) {
        const course = courses[courseIndex];
        const section = sections[sectionIndex];

        scheduleSlots.push({
          schedule_id: 0, // Will be set when saving
          section_num: section.section_num,
          time_slot: timeSlot,
          day: day,
          course_code: course.course_code,
          course_name: course.course_name
        });

        courseIndex++;
        if (courseIndex >= courses.length) {
          courseIndex = 0;
          sectionIndex++;
        }
      }
    }
  }

  return scheduleSlots;
}
