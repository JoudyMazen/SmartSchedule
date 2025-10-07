import { NextApiRequest, NextApiResponse } from "next";
import pool from "../../../lib/database";

interface Course {
  course_code: string;
  course_name: string;
  lecture_hours: number;
  tutorial_hours: number;
  lab_hours: number;
  level: number;
}

interface TimeSlot {
  time_slot: string;
  day: string;
}

interface ScheduleAssignment {
  course_code: string;
  course_name: string;
  activity_type: "Lecture" | "Tutorial" | "Lab";
  section_num: number;
  day: string;
  time_slot: string;
  hours: number;
}

interface SchedulingRule {
  rule_name: string;
  rule_description: string;
  rule_type: string;
  is_active?: boolean;
}

// ───────────────────────────────────────────────────────────────
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const ONE_HOUR_SLOTS = [
  "08:00-08:50",
  "09:00-09:50",
  "10:00-10:50",
  "11:00-11:50",
  "13:00-13:50",
  "14:00-14:50",
];
const TWO_HOUR_SLOTS = [
  "08:00-09:50",
  "09:00-10:50",
  "10:00-11:50",
  "13:00-14:50",
];

// ─── RULE PARSING ──────────────────────────────────────────────
function parseRules(rules: SchedulingRule[]) {
  const settings = {
    lunchBreaks: ["12:00-12:50"],
    labAfterHour: 12,
    maxDailyHours: 8,
    blockedDays: [] as string[],
  };

  for (const r of rules) {
    const desc = r.rule_description.toLowerCase();

    if (desc.includes("12:00") || desc.includes("lunch"))
      settings.lunchBreaks.push("12:00-12:50");

    if (desc.includes("lab") && desc.includes("after")) {
      const num = desc.match(/\d{1,2}/);
      if (num) settings.labAfterHour = parseInt(num[0]);
    }

    if (desc.includes("hour") && desc.includes("day")) {
      const num = desc.match(/\d+/);
      if (num) settings.maxDailyHours = parseInt(num[0]);
    }

    for (const day of DAYS)
      if (desc.includes("no class") && desc.includes(day.toLowerCase()))
        settings.blockedDays.push(day);
  }

  return settings;
}

// ─── MAIN HANDLER ─────────────────────────────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  const { level, group } = req.body;
  if (!level || !group)
    return res.status(400).json({ success: false, error: "Level and group required" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ✅ 1️⃣ Fetch ONLY SWE courses for this specific level
    const courseRes = await client.query<Course>(
      `SELECT course_code, course_name, lecture_hours, tutorial_hours, lab_hours, level
       FROM course 
       WHERE course_code LIKE 'SWE%' 
       AND level = $1 
       AND is_elective = false
       ORDER BY course_code`,
      [level]
    );
    const courses = courseRes.rows;
    
    if (!courses.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        success: false, 
        error: `No SWE courses found for level ${level}` 
      });
    }

    // ✅ 2️⃣ Get existing occupied slots
    const occRes = await client.query(
      `SELECT c.day, c.time_slot FROM contain c
       JOIN schedule s ON c.schedule_id = s.schedule_id
       WHERE s.level_num = $1 AND s.group_num = $2`,
      [level, group]
    );
    const occupied = new Set(occRes.rows.map(r => `${r.day}-${r.time_slot}`));

    // ✅ 3️⃣ Load and parse scheduling rules
    const ruleRes = await client.query<SchedulingRule>(
      `SELECT rule_name, rule_description, rule_type, is_active
       FROM scheduling_rule WHERE is_active = true`
    );
    const ruleSettings = parseRules(ruleRes.rows);

    // ✅ 4️⃣ Get or create schedule
    let scheduleId: number;
    const sres = await client.query(
      `SELECT schedule_id FROM schedule WHERE level_num=$1 AND group_num=$2`,
      [level, group]
    );
    if (sres.rows.length > 0) {
      scheduleId = sres.rows[0].schedule_id;
    } else {
      const ins = await client.query(
        `INSERT INTO schedule(level_num, group_num, status, created_at, updated_at)
         VALUES($1,$2,'draft',NOW(),NOW()) RETURNING schedule_id`,
        [level, group]
      );
      scheduleId = ins.rows[0].schedule_id;
    }

    // ✅ 5️⃣ Generate AI schedule
    const generated = generateSchedule(courses, occupied, ruleSettings);
    
    if (!generated.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        success: false, 
        error: "No valid schedule generated. Not enough free time slots." 
      });
    }

    // ✅ 6️⃣ Save to DB
    let inserted = 0;
    for (const g of generated) {
      // Double-check for conflicts
      const exists = await client.query(
        `SELECT 1 FROM contain WHERE schedule_id=$1 AND day=$2 AND time_slot=$3 LIMIT 1`,
        [scheduleId, g.day, g.time_slot]
      );
      if (exists.rows.length) continue;

      // Insert section
      await client.query(
        `INSERT INTO section(course_code, section_number, activity_type, hours_per_session, capacity)
         VALUES($1,$2,$3,$4,25)
         ON CONFLICT (course_code, section_number, activity_type) DO NOTHING`,
        [g.course_code, g.section_num, g.activity_type, g.hours]
      );

      // Insert into contain
      await client.query(
        `INSERT INTO contain(schedule_id, section_num, course_code, time_slot, day, room, instructor)
         VALUES($1,$2,$3,$4,$5,NULL,NULL)`,
        [scheduleId, g.section_num, g.course_code, g.time_slot, g.day]
      );

      inserted++;
    }

    await client.query(`UPDATE schedule SET updated_at = NOW() WHERE schedule_id=$1`, [scheduleId]);
    await client.query("COMMIT");

    res.status(200).json({
      success: true,
      message: `AI generated schedule with ${inserted} sessions for ${courses.length} SWE courses.`,
      schedule_id: scheduleId,
      applied_rules: ruleSettings,
      courses_scheduled: courses.map(c => c.course_code),
      assignments: generated,
    });

  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("AI schedule error:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to generate schedule" });
  } finally {
    client.release();
  }
}

// ─── GENERATION LOGIC ──────────────────────────────────────────
function generateSchedule(
  courses: Course[],
  occupied: Set<string>,
  ruleSettings: ReturnType<typeof parseRules>
): ScheduleAssignment[] {
  const result: ScheduleAssignment[] = [];
  const used = new Set(occupied);
  const dailyHours: Record<string, number> = {};
  let sectionBase = 50000;

  // Sort courses by total hours (descending) to schedule harder ones first
  const sortedCourses = [...courses].sort((a, b) => {
    const totalA = a.lecture_hours + a.tutorial_hours + a.lab_hours;
    const totalB = b.lecture_hours + b.tutorial_hours + b.lab_hours;
    return totalB - totalA;
  });

  for (const course of sortedCourses) {
    console.log(`\n📚 Scheduling ${course.course_code}:`);
    console.log(`   Lecture: ${course.lecture_hours}h, Tutorial: ${course.tutorial_hours}h, Lab: ${course.lab_hours}h`);

    // 🎯 Schedule Lectures
    if (course.lecture_hours > 0) {
      const lectures = scheduleLectures(
        course,
        used,
        dailyHours,
        ruleSettings,
        sectionBase++
      );
      result.push(...lectures);
      console.log(`   ✅ Scheduled ${lectures.length} lecture sessions`);
    }

    // 🎯 Schedule Tutorials
    if (course.tutorial_hours > 0) {
      const tutorials = scheduleTutorials(
        course,
        used,
        dailyHours,
        ruleSettings,
        sectionBase++
      );
      result.push(...tutorials);
      console.log(`   ✅ Scheduled ${tutorials.length} tutorial sessions`);
    }

    // 🎯 Schedule Labs
    if (course.lab_hours > 0) {
      const labs = scheduleLabs(
        course,
        used,
        dailyHours,
        ruleSettings,
        sectionBase++
      );
      result.push(...labs);
      console.log(`   ✅ Scheduled ${labs.length} lab sessions`);
    }
  }

  return result;
}

// ─── SCHEDULE LECTURES ────────────────────────────────────────
function scheduleLectures(
  course: Course,
  used: Set<string>,
  dailyHours: Record<string, number>,
  ruleSettings: ReturnType<typeof parseRules>,
  sectionNum: number
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  const pattern = getLecturePattern(course.lecture_hours);
  
  // Try to find a common time for all lecture days
  for (const time of ONE_HOUR_SLOTS) {
    const canScheduleAll = pattern.every(day => 
      isSlotAvailable(day, time, 1, used, dailyHours, ruleSettings)
    );

    if (canScheduleAll) {
      // Perfect! Schedule all lectures at the same time
      for (const day of pattern) {
        const key = `${day}-${time}`;
        assignments.push({
          course_code: course.course_code,
          course_name: course.course_name,
          activity_type: "Lecture",
          section_num: sectionNum,
          day,
          time_slot: time,
          hours: 1,
        });
        used.add(key);
        dailyHours[day] = (dailyHours[day] || 0) + 1;
      }
      return assignments;
    }
  }

  // If no common time works, schedule each day separately
  let hoursScheduled = 0;
  for (const day of pattern) {
    if (hoursScheduled >= course.lecture_hours) break;
    
    for (const time of ONE_HOUR_SLOTS) {
      if (isSlotAvailable(day, time, 1, used, dailyHours, ruleSettings)) {
        const key = `${day}-${time}`;
        assignments.push({
          course_code: course.course_code,
          course_name: course.course_name,
          activity_type: "Lecture",
          section_num: sectionNum,
          day,
          time_slot: time,
          hours: 1,
        });
        used.add(key);
        dailyHours[day] = (dailyHours[day] || 0) + 1;
        hoursScheduled++;
        break;
      }
    }
  }

  return assignments;
}

// ─── SCHEDULE TUTORIALS ────────────────────────────────────────
function scheduleTutorials(
  course: Course,
  used: Set<string>,
  dailyHours: Record<string, number>,
  ruleSettings: ReturnType<typeof parseRules>,
  sectionNum: number
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  let hoursScheduled = 0;

  // Try 2-hour slots first if tutorial is 2 hours
  if (course.tutorial_hours === 2) {
    for (const day of DAYS) {
      for (const time of TWO_HOUR_SLOTS) {
        if (isSlotAvailable(day, time, 2, used, dailyHours, ruleSettings)) {
          const key = `${day}-${time}`;
          assignments.push({
            course_code: course.course_code,
            course_name: course.course_name,
            activity_type: "Tutorial",
            section_num: sectionNum,
            day,
            time_slot: time,
            hours: 2,
          });
          used.add(key);
          dailyHours[day] = (dailyHours[day] || 0) + 2;
          return assignments;
        }
      }
    }
  }

  // Use 1-hour slots
  for (const day of DAYS) {
    if (hoursScheduled >= course.tutorial_hours) break;
    
    for (const time of ONE_HOUR_SLOTS) {
      if (hoursScheduled >= course.tutorial_hours) break;
      
      if (isSlotAvailable(day, time, 1, used, dailyHours, ruleSettings)) {
        const key = `${day}-${time}`;
        assignments.push({
          course_code: course.course_code,
          course_name: course.course_name,
          activity_type: "Tutorial",
          section_num: sectionNum,
          day,
          time_slot: time,
          hours: 1,
        });
        used.add(key);
        dailyHours[day] = (dailyHours[day] || 0) + 1;
        hoursScheduled++;
      }
    }
  }

  return assignments;
}

// ─── SCHEDULE LABS ─────────────────────────────────────────────
function scheduleLabs(
  course: Course,
  used: Set<string>,
  dailyHours: Record<string, number>,
  ruleSettings: ReturnType<typeof parseRules>,
  sectionNum: number
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  let hoursScheduled = 0;

  // Labs prefer 2-hour blocks and must be after labAfterHour
  for (const day of DAYS) {
    if (hoursScheduled >= course.lab_hours) break;
    
    // Try 2-hour slots first
    for (const time of TWO_HOUR_SLOTS) {
      if (hoursScheduled >= course.lab_hours) break;
      
      const startHour = parseInt(time.split(":")[0]);
      if (startHour < ruleSettings.labAfterHour) continue;
      
      if (isSlotAvailable(day, time, 2, used, dailyHours, ruleSettings)) {
        const key = `${day}-${time}`;
        assignments.push({
          course_code: course.course_code,
          course_name: course.course_name,
          activity_type: "Lab",
          section_num: sectionNum,
          day,
          time_slot: time,
          hours: 2,
        });
        used.add(key);
        dailyHours[day] = (dailyHours[day] || 0) + 2;
        hoursScheduled += 2;
        break;
      }
    }
  }

  // If still need more hours, try 1-hour afternoon slots
  if (hoursScheduled < course.lab_hours) {
    for (const day of DAYS) {
      if (hoursScheduled >= course.lab_hours) break;
      
      for (const time of ONE_HOUR_SLOTS) {
        if (hoursScheduled >= course.lab_hours) break;
        
        const startHour = parseInt(time.split(":")[0]);
        if (startHour < ruleSettings.labAfterHour) continue;
        
        if (isSlotAvailable(day, time, 1, used, dailyHours, ruleSettings)) {
          const key = `${day}-${time}`;
          assignments.push({
            course_code: course.course_code,
            course_name: course.course_name,
            activity_type: "Lab",
            section_num: sectionNum,
            day,
            time_slot: time,
            hours: 1,
          });
          used.add(key);
          dailyHours[day] = (dailyHours[day] || 0) + 1;
          hoursScheduled++;
        }
      }
    }
  }

  return assignments;
}

// ─── HELPERS ──────────────────────────────────────────────────
function getLecturePattern(hours: number): string[] {
  if (hours >= 3) return ["Sunday", "Tuesday", "Thursday"];
  if (hours === 2) return ["Monday", "Wednesday"];
  return ["Sunday"];
}

function isSlotAvailable(
  day: string,
  time: string,
  hours: number,
  used: Set<string>,
  dailyHours: Record<string, number>,
  ruleSettings: ReturnType<typeof parseRules>
): boolean {
  const key = `${day}-${time}`;
  const startHour = parseInt(time.split(":")[0]);

  // Check if slot is already used
  if (used.has(key)) return false;

  // Check lunch break
  if (ruleSettings.lunchBreaks.includes(time)) return false;

  // Check blocked days
  if (ruleSettings.blockedDays.includes(day)) return false;

  // Check daily hour limit
  if ((dailyHours[day] || 0) + hours > ruleSettings.maxDailyHours) return false;

  // Check valid time range
  if (startHour < 8 || startHour > 14) return false;

  return true;
}