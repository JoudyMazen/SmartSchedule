// pages/api/ai/generate-schedule.ts
// NOW SUPPORTS BOTH SINGLE GROUP AND MULTI-GROUP GENERATION!
import { NextApiRequest, NextApiResponse } from "next";
import pool from "../../../lib/database";
import { geminiModel } from "../../../lib/gemini";

interface Course {
  course_code: string;
  course_name: string;
  lecture_hours: number;
  tutorial_hours: number;
  lab_hours: number;
  level: number;
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
interface ExactCourseRequirement {
    course_code: string;
    course_name: string;
    required_lectures: number;
    required_tutorials: number;
    required_labs: number;
    total_sessions: number;
  }

interface GeminiScheduleSuggestion {
  course_code: string;
  activity_type: string;
  sessions: Array<{
    day: string;
    time_slot: string;
    priority: number;
    reasoning: string;
  }>;
}

// ─── ADD: EXACT HOUR VALIDATION FUNCTIONS ─────────────────────
function validateExactRequirements(courses: Course[]): ExactCourseRequirement[] {
    const exactReqs: ExactCourseRequirement[] = [];
    
    for (const course of courses) {
      const req: ExactCourseRequirement = {
        course_code: course.course_code,
        course_name: course.course_name,
        required_lectures: Math.ceil(course.lecture_hours),
        required_tutorials: Math.ceil(course.tutorial_hours),
        required_labs: calculateLabSessions(course.lab_hours),
        total_sessions: 0
      };
      
      req.total_sessions = req.required_lectures + req.required_tutorials + req.required_labs;
      exactReqs.push(req);
      
      console.log(`📊 ${course.course_code}: ${req.required_lectures}L + ${req.required_tutorials}T + ${req.required_labs}Lab = ${req.total_sessions} sessions`);
    }
    
    return exactReqs;
  }
  
  function calculateLabSessions(labHours: number): number {
    if (labHours === 0) return 0;
    if (labHours === 1) return 1;
    if (labHours === 2) return 1;
    if (labHours === 3) return 2;
    if (labHours === 4) return 2;
    return Math.ceil(labHours / 2);
  }
  
  function validateGeneratedSessions(
    generated: ScheduleAssignment[], 
    exactReqs: ExactCourseRequirement[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const sessionCounts = new Map<string, { lectures: number; tutorials: number; labs: number }>();
    
    // Initialize counts
    for (const req of exactReqs) {
      sessionCounts.set(req.course_code, { lectures: 0, tutorials: 0, labs: 0 });
    }
    
    // Count actual generated sessions
    for (const assignment of generated) {
      const counts = sessionCounts.get(assignment.course_code);
      if (!counts) continue;
      
      if (assignment.activity_type === "Lecture") counts.lectures++;
      if (assignment.activity_type === "Tutorial") counts.tutorials++;
      if (assignment.activity_type === "Lab") counts.labs++;
    }
    
    // Validate against requirements
    for (const req of exactReqs) {
      const actual = sessionCounts.get(req.course_code)!;
      
      if (actual.lectures !== req.required_lectures) {
        errors.push(`${req.course_code}: Expected ${req.required_lectures} lectures, got ${actual.lectures}`);
      }
      if (actual.tutorials !== req.required_tutorials) {
        errors.push(`${req.course_code}: Expected ${req.required_tutorials} tutorials, got ${actual.tutorials}`);
      }
      if (actual.labs !== req.required_labs) {
        errors.push(`${req.course_code}: Expected ${req.required_labs} labs, got ${actual.labs}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];
const ONE_HOUR_SLOTS = [
  "08:00-08:50", "09:00-09:50", "10:00-10:50",
  "11:00-11:50", "13:00-13:50", "14:00-14:50",
];
const TWO_HOUR_SLOTS = [
  "08:00-09:50", "09:00-10:50", "10:00-11:50", "13:00-14:50",
];

// ─── SINGLE GROUP AI GENERATION ───────────────────────────────
async function generateScheduleWithGemini(
  courses: Course[],
  occupied: Set<string>,
  ruleSettings: ReturnType<typeof parseRules>,
  level: number,
  group: number
): Promise<GeminiScheduleSuggestion[]> {
  try {
    const availableSlots: Array<{ day: string; time: string; hours: number }> = [];
    
    for (const day of DAYS) {
      if (ruleSettings.blockedDays.includes(day)) continue;
      
      for (const slot of ONE_HOUR_SLOTS) {
        const key = `${day}-${slot}`;
        if (!occupied.has(key) && !ruleSettings.lunchBreaks.includes(slot)) {
          availableSlots.push({ day, time: slot, hours: 1 });
        }
      }
      
      for (const slot of TWO_HOUR_SLOTS) {
        const key = `${day}-${slot}`;
        if (!occupied.has(key) && !ruleSettings.lunchBreaks.includes(slot)) {
          availableSlots.push({ day, time: slot, hours: 2 });
        }
      }
    }

    const prompt = `
You are an expert university course scheduling AI assistant. Generate an optimal schedule for the following courses.

**SCHEDULING CONTEXT:**
- Level: ${level}
- Group: ${group}
- Total Courses: ${courses.length}

**COURSES TO SCHEDULE:**
${courses.map(c => `
- ${c.course_code} (${c.course_name})
  * Lectures: ${c.lecture_hours} hours
  * Tutorials: ${c.tutorial_hours} hours  
  * Labs: ${c.lab_hours} hours
`).join('\n')}

**AVAILABLE TIME SLOTS:**
${availableSlots.slice(0, 20).map(s => `${s.day} ${s.time} (${s.hours}h)`).join(', ')}... and more

**SCHEDULING RULES:**
- Lunch breaks blocked: ${ruleSettings.lunchBreaks.join(', ')}
- Labs must start after: ${ruleSettings.labAfterHour}:00
- Max daily hours per group: ${ruleSettings.maxDailyHours}
- Blocked days: ${ruleSettings.blockedDays.join(', ') || 'None'}

**SCHEDULING PRINCIPLES:**
1. **Lectures**: Spread across multiple days (e.g., Sun/Tue/Thu for 3hr, Mon/Wed for 2hr)
2. **Tutorials**: Can be 1-hour or 2-hour blocks, preferably mid-week
3. **Labs**: Prefer 2-hour afternoon blocks (after ${ruleSettings.labAfterHour}:00)
4. **Balance**: Distribute workload evenly across the week
5. **Gaps**: Minimize idle time between classes
6. **Patterns**: Keep consistent timing for same activity type when possible

**OUTPUT FORMAT:**
Respond ONLY with valid JSON (no markdown, no code blocks). Structure:
{
  "schedule": [
    {
      "course_code": "SWE101",
      "activity_type": "Lecture",
      "sessions": [
        {
          "day": "Sunday",
          "time_slot": "08:00-08:50",
          "priority": 10,
          "reasoning": "Morning slot, first lecture of the week"
        }
      ]
    }
  ],
  "analysis": {
    "total_sessions": 25,
    "efficiency_score": 85,
    "workload_distribution": {
      "Sunday": 4,
      "Monday": 5,
      "Tuesday": 4,
      "Wednesday": 5,
      "Thursday": 4
    },
    "warnings": ["Heavy Monday load"],
    "suggestions": ["Consider moving Lab to Thursday afternoon"]
  }
}

Generate the complete schedule now.`;

    console.log('🤖 Sending request to Gemini AI...');
    
    const result = await geminiModel.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log('📥 Gemini response received');
    
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\s*/, '').replace(/```\s*$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\s*/, '').replace(/```\s*$/, '');
    }
    
    const parsed = JSON.parse(jsonText);
    console.log('✅ AI Analysis:', parsed.analysis);
    
    return parsed.schedule || [];
    
  } catch (error) {
    console.error('❌ Gemini AI error:', error);
    throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
// ─── UPDATE: MULTI-GROUP AI GENERATION WITH EXISTING COURSE AWARENESS ───
async function generateMultiGroupScheduleWithAI(
    courses: Course[],
    numberOfGroups: number,
    level: number,
    ruleSettings: ReturnType<typeof parseRules>,
    client: any // Add client parameter to query database
  ): Promise<Map<number, GeminiScheduleSuggestion[]>> {
    try {
      const exactReqs = validateExactRequirements(courses);
      const totalRequiredSessions = exactReqs.reduce((sum, req) => sum + req.total_sessions, 0);
      console.log(`🎯 Total required sessions: ${totalRequiredSessions}`);
  
      // ─── CRITICAL: FETCH EXISTING OTHER DEPARTMENT COURSES ─────────────────
      console.log('🔍 Fetching existing other department courses...');
      const existingCoursesRes = await client.query(
        `SELECT c.day, c.time_slot, s.group_num 
         FROM contain c
         JOIN schedule s ON c.schedule_id = s.schedule_id
         JOIN course co ON c.course_code = co.course_code
         WHERE s.level_num = $1 
         AND co.course_code NOT LIKE 'SWE%'
         AND s.group_num BETWEEN $2 AND $3`,
        [level, 1, numberOfGroups]
      );
  
      const existingSlotsByGroup = new Map<number, Set<string>>();
      
      // Initialize groups
      for (let groupNum = 1; groupNum <= numberOfGroups; groupNum++) {
        existingSlotsByGroup.set(groupNum, new Set<string>());
      }
  
      // Populate existing slots
      for (const row of existingCoursesRes.rows) {
        const groupNum = row.group_num;
        const slotKey = `${row.day}-${row.time_slot}`;
        const groupSlots = existingSlotsByGroup.get(groupNum);
        if (groupSlots) {
          groupSlots.add(slotKey);
          console.log(`📌 Group ${groupNum}: Other dept course at ${slotKey}`);
        }
      }
  
      // Build occupied slots info for AI prompt
      const occupiedSlotsInfo: string[] = [];
      for (let groupNum = 1; groupNum <= numberOfGroups; groupNum++) {
        const slots = existingSlotsByGroup.get(groupNum);
        if (slots && slots.size > 0) {
          occupiedSlotsInfo.push(`Group ${groupNum}: ${Array.from(slots).join(', ')}`);
        }
      }
  
      const prompt = `
      CRITICAL REQUIREMENT - RESPECT EXISTING OTHER DEPARTMENT COURSES:
      
      **EXISTING OTHER DEPARTMENT COURSES (DO NOT USE THESE TIME SLOTS):**
      ${occupiedSlotsInfo.length > 0 ? occupiedSlotsInfo.join('\n') : 'No existing courses found'}
      
      **IMPORTANT:**
      - NEVER schedule SWE courses in time slots occupied by other departments
      - Find FREE time slots only
      - Other department courses are FIXED and cannot be moved
      
  **EXACT SESSION REQUIREMENTS (same for all groups):**
  ${exactReqs.map(req => `
  - ${req.course_code}: 
    * ${req.required_lectures} Lecture sessions
    * ${req.required_tutorials} Tutorial sessions  
    * ${req.required_labs} Lab sessions
    * TOTAL: ${req.total_sessions} sessions exactly
  `).join('')}
  
  **COURSES TO SCHEDULE (SWE courses only):**
  ${courses.map(c => `
  - ${c.course_code} (${c.course_name})
    * Lectures: ${c.lecture_hours} hours → ${Math.ceil(c.lecture_hours)} sessions
    * Tutorials: ${c.tutorial_hours} hours → ${Math.ceil(c.tutorial_hours)} sessions
    * Labs: ${c.lab_hours} hours → ${calculateLabSessions(c.lab_hours)} sessions
  `).join('\n')}
  
  **IMPORTANT CONSTRAINTS:**
  1. DO NOT use time slots that are already occupied by other department courses
  2. Schedule ONLY in available free time slots
  3. Each group may have different occupied slots
  
  **AVAILABLE TIME SLOTS:**
  Days: Sunday, Monday, Tuesday, Wednesday, Thursday
  Morning: 08:00-08:50, 09:00-09:50, 10:00-10:50, 11:00-11:50
  Afternoon: 13:00-13:50, 14:00-14:50
  Two-hour blocks: 08:00-09:50, 09:00-10:50, 10:00-11:50, 13:00-14:50
  
  **SCHEDULING RULES:**
  - Lunch break: 12:00-12:50 (blocked)
  - Labs must be after ${ruleSettings.labAfterHour}:00
  - Lectures: Spread across multiple days
  - Max ${ruleSettings.maxDailyHours} hours per day per group
  
  **STRICT REQUIREMENTS:**
  - Never schedule over existing other department courses
  - Never convert between lecture/tutorial/lab
  - Never add extra sessions
  - Never miss required sessions
  
  **OUTPUT FORMAT (MUST BE VALID JSON):**
  {
    "groups": [
      {
        "group_number": 1,
        "schedule": [
          {
            "course_code": "SWE301",
            "activity_type": "Lecture",
            "sessions": [
              {
                "day": "Sunday",
                "time_slot": "08:00-08:50",
                "priority": 10,
                "reasoning": "Group 1 morning slot - avoiding existing courses"
              }
            ]
          }
        ]
      }
    ],
    "verification": {
      "all_groups_have_exact_session_counts": true,
      "group_session_totals": {
        "group_1": 15,
        "group_2": 15
      }
    }
  }
  
  Generate complete schedules for all ${numberOfGroups} groups with EXACT session counts, DIFFERENT times, and RESPECTING existing other department courses!`;
  
      console.log(`🤖 Requesting AI to generate ${numberOfGroups} group schedules with existing course awareness...`);
      
      const result = await geminiModel.generateContent(prompt);
      let responseText = result.response.text();
      
      responseText = responseText.trim();
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      const parsed = JSON.parse(responseText);
      console.log('✅ AI Multi-Group Verification:', parsed.verification);
      
      const scheduleMap = new Map<number, GeminiScheduleSuggestion[]>();
      
      for (const groupData of parsed.groups) {
        const groupNum = groupData.group_number;
        scheduleMap.set(groupNum, groupData.schedule);
      }
      
      return scheduleMap;
      
    } catch (error) {
      console.error('❌ AI multi-group generation failed:', error);
      throw error;
    }
  }
 // ─── ADD: SESSION COMPLETION LOGIC ───────────────────────────
async function completeMissingSessions(
  generated: ScheduleAssignment[],
  exactReqs: ExactCourseRequirement[],
  courses: Course[],
  occupied: Set<string>,
  ruleSettings: ReturnType<typeof parseRules>,
  level: number, // Add level parameter
  groupNum: number,
  client: any
): Promise<ScheduleAssignment[]> {
  
  // First, enhance the occupied set with other department courses for this specific group
  const enhancedOccupied = new Set(occupied);
  
  // Query for other department courses for this specific group
  const otherDeptRes = await client.query(
    `SELECT c.day, c.time_slot 
     FROM contain c
     JOIN schedule s ON c.schedule_id = s.schedule_id
     JOIN course co ON c.course_code = co.course_code
     WHERE s.level_num = $1 
     AND s.group_num = $2
     AND co.course_code NOT LIKE 'SWE%'`,
    [level, groupNum]
  );
  
  for (const row of otherDeptRes.rows) {
    const slotKey = `${row.day}-${row.time_slot}`;
    enhancedOccupied.add(slotKey);
    console.log(`🚫 Group ${groupNum}: Respecting existing course at ${slotKey}`);
  }
  
  // Rest of the function remains the same, but use enhancedOccupied instead of occupied
  const completed = [...generated];
  const usedSlots = new Set(enhancedOccupied); // Use enhanced set
  let sectionBase = 60000;
  
  // Track what slots are already used by generated sessions
  for (const assignment of generated) {
    usedSlots.add(`${assignment.day}-${assignment.time_slot}`);
  }
  
  // Count current sessions per course
  const currentCounts = new Map<string, { lectures: number; tutorials: number; labs: number }>();
  for (const req of exactReqs) {
    currentCounts.set(req.course_code, { lectures: 0, tutorials: 0, labs: 0 });
  }
  for (const assignment of generated) {
    const counts = currentCounts.get(assignment.course_code);
    if (!counts) continue;
    if (assignment.activity_type === "Lecture") counts.lectures++;
    if (assignment.activity_type === "Tutorial") counts.tutorials++;
    if (assignment.activity_type === "Lab") counts.labs++;
  }
  
  // Find and complete missing sessions
  for (const req of exactReqs) {
    const current = currentCounts.get(req.course_code)!;
    const course = courses.find(c => c.course_code === req.course_code)!;
    
    console.log(`🔍 ${req.course_code}: Current ${current.lectures}L/${current.tutorials}T/${current.labs}L, Need ${req.required_lectures}L/${req.required_tutorials}T/${req.required_labs}L`);
    
    // Complete missing lectures
    while (current.lectures < req.required_lectures) {
      const newSession = findAvailableSlot("Lecture", 1, usedSlots, ruleSettings, sectionBase++);
      if (newSession) {
        completed.push({
          ...newSession,
          course_code: req.course_code,
          course_name: course.course_name,
          section_num: sectionBase++
        });
        current.lectures++;
        console.log(`   ➕ Added missing lecture for ${req.course_code}`);
      } else {
        console.warn(`   ⚠️ Could not find slot for missing lecture in ${req.course_code}`);
        break;
      }
    }
    
    // Complete missing tutorials
    while (current.tutorials < req.required_tutorials) {
      const hoursNeeded = course.tutorial_hours === 2 ? 2 : 1;
      const newSession = findAvailableSlot("Tutorial", hoursNeeded, usedSlots, ruleSettings, sectionBase++);
      if (newSession) {
        completed.push({
          ...newSession,
          course_code: req.course_code,
          course_name: course.course_name,
          section_num: sectionBase++
        });
        current.tutorials++;
        console.log(`   ➕ Added missing tutorial for ${req.course_code}`);
      } else {
        console.warn(`   ⚠️ Could not find slot for missing tutorial in ${req.course_code}`);
        break;
      }
    }
    
    // Complete missing labs
    while (current.labs < req.required_labs) {
      const hoursNeeded = course.lab_hours >= 2 ? 2 : 1;
      const newSession = findAvailableSlot("Lab", hoursNeeded, usedSlots, ruleSettings, sectionBase++);
      if (newSession) {
        completed.push({
          ...newSession,
          course_code: req.course_code,
          course_name: course.course_name,
          section_num: sectionBase++
        });
        current.labs++;
        console.log(`   ➕ Added missing lab for ${req.course_code}`);
      } else {
        console.warn(`   ⚠️ Could not find slot for missing lab in ${req.course_code}`);
        break;
      }
    }
  }
  
  return completed;
}

  
  function findAvailableSlot(
    activityType: "Lecture" | "Tutorial" | "Lab",
    hours: number,
    usedSlots: Set<string>,
    ruleSettings: ReturnType<typeof parseRules>,
    sectionNum: number
  ): Omit<ScheduleAssignment, 'course_code' | 'course_name'> | null {
    
    const slots = hours === 2 ? TWO_HOUR_SLOTS : ONE_HOUR_SLOTS;
    
    for (const day of DAYS) {
      if (ruleSettings.blockedDays.includes(day)) continue;
      
      for (const time of slots) {
        // Skip if lab is scheduled before allowed time
        if (activityType === "Lab") {
          const startHour = parseInt(time.split(":")[0]);
          if (startHour < ruleSettings.labAfterHour) continue;
        }
        
        // Skip lunch breaks
        if (ruleSettings.lunchBreaks.includes(time)) continue;
        
        const key = `${day}-${time}`;
        if (!usedSlots.has(key)) {
          usedSlots.add(key);
          return {
            activity_type: activityType,
            section_num: sectionNum,
            day: day,
            time_slot: time,
            hours: hours
          };
        }
      }
    }
    
    return null;
  }
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

// ─── MAIN HANDLER (SUPPORTS BOTH MODES!) ──────────────────────
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ success: false, error: "Method not allowed" });

  const { level, group, numberOfGroups, useAI = true } = req.body;
  
  // Determine mode: Single group or Multi-group
  const isMultiGroup = numberOfGroups && numberOfGroups > 1;
  
  if (!level) {
    return res.status(400).json({ success: false, error: "Level is required" });
  }
  
  if (!isMultiGroup && !group) {
    return res.status(400).json({ 
      success: false, 
      error: "Either 'group' (for single) or 'numberOfGroups' (for multi) is required" 
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (isMultiGroup) {
      console.log(`\n🎓 MULTI-GROUP MODE: Generating schedules for ${numberOfGroups} groups at Level ${level}`);
    } else {
      console.log(`\n🎓 SINGLE-GROUP MODE: Generating schedule for Level ${level}, Group ${group}`);
    }

   // In the main handler, update the course query:
const courseRes = await client.query<Course>(
    `SELECT course_code, course_name, lecture_hours, tutorial_hours, lab_hours, level
     FROM course 
     WHERE course_code LIKE 'SWE%' 
     AND level = $1 
     AND (lecture_hours > 0 OR tutorial_hours > 0 OR lab_hours > 0)
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

    console.log(`📚 Found ${courses.length} SWE courses to schedule`);

    // ✅ Load scheduling rules
    const ruleRes = await client.query<SchedulingRule>(
      `SELECT rule_name, rule_description, rule_type, is_active
       FROM scheduling_rule WHERE is_active = true`
    );
    const ruleSettings = parseRules(ruleRes.rows);
    console.log(`📋 Applied ${ruleRes.rows.length} scheduling rules`);

   // ─── MULTI-GROUP GENERATION ───────────────────────────────
if (isMultiGroup) {
    if (!useAI) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: 'Multi-group scheduling requires AI. Set useAI: true'
      });
    }
  
    console.log('🤖 Using Gemini AI for multi-group intelligent scheduling...');
    
    // ✅ ADD THIS: Define exactReqs here
    const exactReqs = validateExactRequirements(courses);
    const totalRequiredSessions = exactReqs.reduce((sum, req) => sum + req.total_sessions, 0);
    console.log(`🎯 Total required sessions for Level ${level}: ${totalRequiredSessions}`);
    
    let groupSchedulesMap: Map<number, GeminiScheduleSuggestion[]>;
      try {
        groupSchedulesMap = await generateMultiGroupScheduleWithAI(
          courses,
          numberOfGroups,
          level,
          ruleSettings,
          client // Pass the database client
        );
      } catch (aiError) {
        await client.query("ROLLBACK");
        return res.status(500).json({
          success: false,
          error: 'AI multi-group generation failed',
          details: aiError instanceof Error ? aiError.message : 'Unknown error'
        });
      }

      const results = [];
  
  for (let groupNum = 1; groupNum <= numberOfGroups; groupNum++) {
    const aiSuggestions = groupSchedulesMap.get(groupNum);
    
    if (!aiSuggestions || aiSuggestions.length === 0) {
      console.warn(`⚠️ No AI suggestions for group ${groupNum}`);
      continue;
    }

    // Get or create schedule
    let scheduleId: number;
    const sres = await client.query(
      `SELECT schedule_id FROM schedule WHERE level_num=$1 AND group_num=$2`,
      [level, groupNum]
    );
    if (sres.rows.length > 0) {
        scheduleId = sres.rows[0].schedule_id;
        // ✅ FIXED: Only delete SWE courses, preserve other departments
        await client.query(
          `DELETE FROM contain 
           WHERE schedule_id = $1 
           AND course_code LIKE 'SWE%'`, // ← ONLY delete SWE courses
          [scheduleId]
        );
      } else {
        const ins = await client.query(
          `INSERT INTO schedule(level_num, group_num, status, created_at, updated_at)
           VALUES($1,$2,'active',NOW(),NOW()) RETURNING schedule_id`,
          [level, groupNum]
        );
        scheduleId = ins.rows[0].schedule_id;
      }

  // ✅ FIXED: Get occupied slots including other departments
  const occupiedRes = await client.query(
    `SELECT c.day, c.time_slot 
     FROM contain c
     JOIN schedule s ON c.schedule_id = s.schedule_id
     WHERE s.level_num = $1 AND s.group_num = $2`,
    [level, groupNum]
  );
  const occupiedSlots = new Set(occupiedRes.rows.map(r => `${r.day}-${r.time_slot}`));
  
  console.log(`🚫 Group ${groupNum}: ${occupiedSlots.size} occupied slots (including other departments)`);

  let generated = convertAISuggestionsToAssignments(
    aiSuggestions,
    courses,
    occupiedSlots, // ← Pass actual occupied slots
    ruleSettings
  );

// ✅ ADD VALIDATION AND COMPLETION
console.log(`🔍 Validating AI-generated session counts for Group ${groupNum}...`);
const validation = validateGeneratedSessions(generated, exactReqs);
if (!validation.isValid) {
  console.warn(`⚠️ Group ${groupNum} session count mismatch: ${validation.errors.join(', ')}`);
  console.log('🛠️ Attempting to complete missing sessions...');
  
  // Try to complete missing sessions - FIXED: Added level parameter and await
  const completed = await completeMissingSessions(generated, exactReqs, courses, new Set(), ruleSettings, level, groupNum, client);
  const completedValidation = validateGeneratedSessions(completed, exactReqs);
  
  if (completedValidation.isValid) {
    console.log(`✅ Successfully completed sessions for group ${groupNum}`);
    generated = completed;
  } else {
    console.error(`❌ Still missing sessions after completion: ${completedValidation.errors.join(', ')}`);
    // Continue with what we have, but log the issue
  }
}

console.log(`📋 Final session counts for Group ${groupNum}:`);
const finalCounts = validateGeneratedSessions(generated, exactReqs);
if (!finalCounts.isValid) {
  console.warn(`❌ Final validation failed: ${finalCounts.errors.join(', ')}`);
} else {
  console.log(`✅ All courses have exact session counts!`);
}
          

let inserted = 0;
for (const assignment of generated) {
  // ✅ Check if slot is still available (double-check)
  const slotOccupied = await client.query(
    `SELECT 1 FROM contain 
     WHERE schedule_id = $1 AND day = $2 AND time_slot = $3
     AND course_code NOT LIKE 'SWE%'`, // ← Check other departments only
    [scheduleId, assignment.day, assignment.time_slot]
  );
  
  if (slotOccupied.rows.length > 0) {
    console.warn(`⏭️ Skipping ${assignment.course_code} - slot occupied by other department: ${assignment.day} ${assignment.time_slot}`);
    continue;
  }

  await client.query(
    `INSERT INTO section(course_code, section_number, activity_type, hours_per_session, capacity)
     VALUES($1,$2,$3,$4,25)
     ON CONFLICT (course_code, section_number, activity_type) DO NOTHING`,
    [assignment.course_code, assignment.section_num, assignment.activity_type, assignment.hours]
  );
  await client.query(
    `INSERT INTO contain(schedule_id, section_num, course_code, time_slot, day, room, instructor)
     VALUES($1,$2,$3,$4,$5,NULL,NULL)`,
    [scheduleId, assignment.section_num, assignment.course_code, assignment.time_slot, assignment.day]
  );
  inserted++;
}

        await client.query(`UPDATE schedule SET updated_at = NOW() WHERE schedule_id=$1`, [scheduleId]);
        console.log(`✅ Group ${groupNum}: Inserted ${inserted} sessions`);

        results.push({
          group_num: groupNum,
          schedule_id: scheduleId,
          total_sessions: inserted
        });
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: `AI generated schedules for ${results.length} groups at Level ${level}`,
        mode: 'multi-group',
        level: level,
        groups: results,
        total_courses: courses.length,
        courses_scheduled: courses.map(c => c.course_code),
        generation_method: 'gemini-ai-multi-group'
      });
    }
// ─── SINGLE GROUP GENERATION ───────────────────────────────
else {
    // ✅ FIXED: Get ALL occupied slots (SWE + other departments)
    const occRes = await client.query(
      `SELECT c.day, c.time_slot FROM contain c
       JOIN schedule s ON c.schedule_id = s.schedule_id
       WHERE s.level_num = $1 AND s.group_num = $2`,
      [level, group]
    );
    const occupied = new Set(occRes.rows.map(r => `${r.day}-${r.time_slot}`));
    console.log(`🚫 ${occupied.size} time slots already occupied (including other departments)`);
  
    // Get or create schedule
    let scheduleId: number;
    const sres = await client.query(
      `SELECT schedule_id FROM schedule WHERE level_num=$1 AND group_num=$2`,
      [level, group]
    );
    if (sres.rows.length > 0) {
      scheduleId = sres.rows[0].schedule_id;
      // ✅ FIXED: Only clear SWE courses for this schedule
      await client.query(
        `DELETE FROM contain 
         WHERE schedule_id = $1 
         AND course_code LIKE 'SWE%'`, // ← ONLY delete SWE courses
        [scheduleId]
      );
    } else {
      const ins = await client.query(
        `INSERT INTO schedule(level_num, group_num, status, created_at, updated_at)
         VALUES($1,$2,'draft',NOW(),NOW()) RETURNING schedule_id`,
        [level, group]
      );
      scheduleId = ins.rows[0].schedule_id;
    }
  
    // ✅ ADD THIS: Define generated variable
    let generated: ScheduleAssignment[];
    
    if (useAI) {
      console.log('🤖 Using Gemini AI for intelligent scheduling...');
      try {
        const aiSuggestions = await generateScheduleWithGemini(
          courses,
          occupied,
          ruleSettings,
          level,
          group
        );
        
        generated = convertAISuggestionsToAssignments(
          aiSuggestions,
          courses,
          occupied,
          ruleSettings
        );
        
        console.log(`✨ AI generated ${generated.length} sessions`);
      } catch (aiError) {
        console.warn('⚠️ AI generation failed, using fallback algorithm');
        generated = generateScheduleFallback(courses, occupied, ruleSettings);
      }
    } else {
      console.log('🔧 Using traditional algorithm...');
      generated = generateScheduleFallback(courses, occupied, ruleSettings);
    }
    
    if (!generated.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        success: false, 
        error: "No valid schedule generated. Not enough free time slots." 
      });
    }
  
    // ✅ ADD: Validation for single group too
    const exactReqs = validateExactRequirements(courses);
    console.log(`🔍 Validating AI-generated session counts for Group ${group}...`);
    const validation = validateGeneratedSessions(generated, exactReqs);
    if (!validation.isValid) {
      console.warn(`⚠️ Group ${group} session count mismatch: ${validation.errors.join(', ')}`);
      console.log('🛠️ Attempting to complete missing sessions...');
      
      const completed = await completeMissingSessions(generated, exactReqs, courses, occupied, ruleSettings, level, group, client);
      const completedValidation = validateGeneratedSessions(completed, exactReqs);
      
      if (completedValidation.isValid) {
        console.log(`✅ Successfully completed sessions for group ${group}`);
        generated = completed;
      } else {
        console.error(`❌ Still missing sessions after completion: ${completedValidation.errors.join(', ')}`);
      }
    }
  
    // Save to DB with conflict checking
    let inserted = 0;
    for (const g of generated) {
      // ✅ Double-check slot isn't occupied by other departments
      const slotOccupied = await client.query(
        `SELECT 1 FROM contain 
         WHERE schedule_id = $1 AND day = $2 AND time_slot = $3
         AND course_code NOT LIKE 'SWE%'`,
        [scheduleId, g.day, g.time_slot]
      );
      
      if (slotOccupied.rows.length > 0) {
        console.warn(`⏭️ Skipping ${g.course_code} - slot occupied by other department: ${g.day} ${g.time_slot}`);
        continue;
      }
  
      await client.query(
        `INSERT INTO section(course_code, section_number, activity_type, hours_per_session, capacity)
         VALUES($1,$2,$3,$4,25)
         ON CONFLICT (course_code, section_number, activity_type) DO NOTHING`,
        [g.course_code, g.section_num, g.activity_type, g.hours]
      );
  
      await client.query(
        `INSERT INTO contain(schedule_id, section_num, course_code, time_slot, day, room, instructor)
         VALUES($1,$2,$3,$4,$5,NULL,NULL)`,
        [scheduleId, g.section_num, g.course_code, g.time_slot, g.day]
      );
      inserted++;
    }
  
    await client.query(`UPDATE schedule SET updated_at = NOW() WHERE schedule_id=$1`, [scheduleId]);
    await client.query("COMMIT");
  
    console.log(`✅ Successfully inserted ${inserted} sessions into database`);
  
    return res.status(200).json({
      success: true,
      message: `${useAI ? 'AI' : 'Algorithm'} generated schedule with ${inserted} sessions for ${courses.length} SWE courses.`,
      mode: 'single-group',
      schedule_id: scheduleId,
      generation_method: useAI ? 'gemini-ai' : 'traditional',
      applied_rules: ruleSettings,
      courses_scheduled: courses.map(c => c.course_code),
      assignments: generated,
      stats: {
        total_courses: courses.length,
        total_sessions: inserted,
        occupied_slots_before: occupied.size,
      }
    });
  }
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("❌ Schedule generation error:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message || "Failed to generate schedule" 
    });
  } finally {
    client.release();
  }
}
// ─── HELPER FUNCTIONS ──────────────────────────────────────────
function convertAISuggestionsToAssignments(
  suggestions: GeminiScheduleSuggestion[],
  courses: Course[],
  occupied: Set<string>, // This now includes other department slots
  ruleSettings: ReturnType<typeof parseRules>
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  const used = new Set(occupied); // Start with occupied slots
  let sectionBase = 50000;

  for (const suggestion of suggestions) {
    const course = courses.find(c => c.course_code === suggestion.course_code);
    if (!course) continue;

    const sortedSessions = suggestion.sessions.sort((a, b) => b.priority - a.priority);

    for (const session of sortedSessions) {
      const key = `${session.day}-${session.time_slot}`;
      
      // ✅ This will now skip slots occupied by other departments
      if (used.has(key)) {
        console.log(`⏭️ Skipping occupied slot: ${key}`);
        continue;
      }
      
      const hours = session.time_slot.includes("09:50") || 
                    session.time_slot.includes("10:50") || 
                    session.time_slot.includes("14:50") ? 2 : 1;

      if (!isSlotValid(session.day, session.time_slot, hours, used, ruleSettings)) {
        continue;
      }

      assignments.push({
        course_code: suggestion.course_code,
        course_name: course.course_name,
        activity_type: suggestion.activity_type as any,
        section_num: sectionBase,
        day: session.day,
        time_slot: session.time_slot,
        hours,
      });

      used.add(key);
    }
    sectionBase++;
  }

  return assignments;
}
function isSlotValid(
  day: string,
  time: string,
  hours: number,
  used: Set<string>,
  ruleSettings: ReturnType<typeof parseRules>
): boolean {
  const key = `${day}-${time}`;
  if (used.has(key)) return false;
  if (ruleSettings.lunchBreaks.includes(time)) return false;
  if (ruleSettings.blockedDays.includes(day)) return false;
  const startHour = parseInt(time.split(":")[0]);
  if (startHour < 8 || startHour > 14) return false;
  return true;
}

// ─── FALLBACK GENERATION ──────────────────────────────────────
function generateScheduleFallback(
  courses: Course[],
  occupied: Set<string>,
  ruleSettings: ReturnType<typeof parseRules>
): ScheduleAssignment[] {
  const result: ScheduleAssignment[] = [];
  const used = new Set(occupied);
  const dailyHours: Record<string, number> = {};
  let sectionBase = 50000;

  const sortedCourses = [...courses].sort((a, b) => {
    const totalA = a.lecture_hours + a.tutorial_hours + a.lab_hours;
    const totalB = b.lecture_hours + b.tutorial_hours + b.lab_hours;
    return totalB - totalA;
  });

  for (const course of sortedCourses) {
    if (course.lecture_hours > 0) {
      const lectures = scheduleLectures(course, used, dailyHours, ruleSettings, sectionBase++);
      result.push(...lectures);
    }
    if (course.tutorial_hours > 0) {
      const tutorials = scheduleTutorials(course, used, dailyHours, ruleSettings, sectionBase++);
      result.push(...tutorials);
    }
    if (course.lab_hours > 0) {
      const labs = scheduleLabs(course, used, dailyHours, ruleSettings, sectionBase++);
      result.push(...labs);
    }
  }
  return result;
}

function scheduleLectures(course: Course, used: Set<string>, dailyHours: Record<string, number>, ruleSettings: ReturnType<typeof parseRules>, sectionNum: number): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  const pattern = getLecturePattern(course.lecture_hours);
  
  for (const time of ONE_HOUR_SLOTS) {
    const canScheduleAll = pattern.every(day => isSlotAvailable(day, time, 1, used, dailyHours, ruleSettings));
    if (canScheduleAll) {
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

function scheduleTutorials(course: Course, used: Set<string>, dailyHours: Record<string, number>, ruleSettings: ReturnType<typeof parseRules>, sectionNum: number): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  let hoursScheduled = 0;

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

function scheduleLabs(course: Course, used: Set<string>, dailyHours: Record<string, number>, ruleSettings: ReturnType<typeof parseRules>, sectionNum: number): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  let hoursScheduled = 0;

  for (const day of DAYS) {
    if (hoursScheduled >= course.lab_hours) break;
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

function getLecturePattern(hours: number): string[] {
  if (hours >= 3) return ["Sunday", "Tuesday", "Thursday"];
  if (hours === 2) return ["Monday", "Wednesday"];
  return ["Sunday"];
}

function isSlotAvailable(day: string, time: string, hours: number, used: Set<string>, dailyHours: Record<string, number>, ruleSettings: ReturnType<typeof parseRules>): boolean {
  const key = `${day}-${time}`;
  const startHour = parseInt(time.split(":")[0]);
  if (used.has(key)) return false;
  if (ruleSettings.lunchBreaks.includes(time)) return false;
  if (ruleSettings.blockedDays.includes(day)) return false;
  if ((dailyHours[day] || 0) + hours > ruleSettings.maxDailyHours) return false;
  if (startHour < 8 || startHour > 14) return false;
  return true;
}

