// pages/api/ai/generate-schedule.ts
// NOW SUPPORTS BOTH SINGLE GROUP AND MULTI-GROUP GENERATION!
import { NextApiRequest, NextApiResponse } from "next";
import pool from "../../../lib/db";
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
      // For 2-hour courses, schedule as 1 continuous 2-hour lecture
      // For other courses, use the standard calculation
      const required_lectures = course.lecture_hours === 2 ? 1 : Math.ceil(course.lecture_hours);
      
      const req: ExactCourseRequirement = {
        course_code: course.course_code,
        course_name: course.course_name,
        required_lectures: required_lectures,
        required_tutorials: Math.ceil(course.tutorial_hours),
        required_labs: calculateLabSessions(course.lab_hours, course.course_code),
        total_sessions: 0
      };
      
      req.total_sessions = req.required_lectures + req.required_tutorials + req.required_labs;
      exactReqs.push(req);
      
      console.log(`📊 ${course.course_code}: ${req.required_lectures}L + ${req.required_tutorials}T + ${req.required_labs}Lab = ${req.total_sessions} sessions`);
    }
    
    return exactReqs;
  }
  
  function calculateLabSessions(labHours: number, courseCode?: string): number {
    if (labHours === 0) return 0;
    if (labHours === 1) return 1;
    // For SWE444 or any 2-hour lab course, schedule 2 sessions per week (each 2 hours)
    if (labHours === 2 && courseCode === "SWE444") return 2;
    if (labHours === 2) return 1; // Other 2-hour labs: 1 session
    if (labHours === 3) return 2;
    if (labHours === 4) return 2;
    return Math.ceil(labHours / 2);
  }
  
  // Function to remove extra sessions beyond required counts
  function enforceExactSessionCounts(
    generated: ScheduleAssignment[],
    exactReqs: ExactCourseRequirement[]
  ): ScheduleAssignment[] {
    const enforced: ScheduleAssignment[] = [];
    const sessionCounts = new Map<string, { lectures: number; tutorials: number; labs: number }>();
    
    // Initialize counts
    for (const req of exactReqs) {
      sessionCounts.set(req.course_code, { lectures: 0, tutorials: 0, labs: 0 });
    }
    
    // Process assignments and enforce limits
    for (const assignment of generated) {
      const req = exactReqs.find(r => r.course_code === assignment.course_code);
      if (!req) continue; // Skip courses not in requirements
      
      const counts = sessionCounts.get(assignment.course_code)!;
      let shouldAdd = false;
      
      if (assignment.activity_type === "Lecture" && counts.lectures < req.required_lectures) {
        counts.lectures++;
        shouldAdd = true;
      } else if (assignment.activity_type === "Tutorial" && counts.tutorials < req.required_tutorials) {
        counts.tutorials++;
        shouldAdd = true;
      } else if (assignment.activity_type === "Lab" && counts.labs < req.required_labs) {
        counts.labs++;
        shouldAdd = true;
      }
      
      if (shouldAdd) {
        enforced.push(assignment);
      } else {
        // Log when we skip an extra session
        console.log(`⚠️ Removing extra ${assignment.activity_type} session for ${assignment.course_code} (already have ${counts.lectures}L/${counts.tutorials}T/${counts.labs}Lab, need ${req.required_lectures}L/${req.required_tutorials}T/${req.required_labs}Lab)`);
      }
    }
    
    return enforced;
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
${courses.map(c => {
  // For 2-hour courses, schedule as 1 continuous 2-hour lecture
  const lectureSessions = c.lecture_hours === 2 ? 1 : Math.ceil(c.lecture_hours);
  const lectureDesc = c.lecture_hours === 2 
    ? `${c.lecture_hours} hours → 1 continuous 2-hour lecture`
    : `${c.lecture_hours} hours → ${lectureSessions} session(s)`;
  return `
- ${c.course_code} (${c.course_name})
  * Lectures: ${lectureDesc}
  * Tutorials: ${c.tutorial_hours} hours  
  * Labs: ${c.lab_hours} hours
`;
}).join('\n')}

**AVAILABLE TIME SLOTS:**
${availableSlots.slice(0, 20).map(s => `${s.day} ${s.time} (${s.hours}h)`).join(', ')}... and more

**SCHEDULING RULES:**
- Lunch breaks blocked: ${ruleSettings.lunchBreaks.join(', ')}
- Labs must start after: ${ruleSettings.labAfterHour}:00
- Max daily hours per group: ${ruleSettings.maxDailyHours}
- Blocked days: ${ruleSettings.blockedDays.join(', ') || 'None'}
- **MIDTERM SLOTS (NO LECTURES):** Monday 12:00-13:50, Wednesday 12:00-13:50 - Lectures cannot be scheduled during these times

**SCHEDULING PRINCIPLES:**
1. **PRIORITIZE EARLY SLOTS**: Always prefer morning slots (08:00-11:50) over afternoon slots (13:00-14:50)
2. **MINIMIZE GAPS**: Schedule classes consecutively when possible - avoid long breaks (2+ hours) between classes on the same day
3. **Lectures**: 
   - 2-hour courses: MUST be scheduled as 1 continuous 2-hour lecture (use 2-hour time slots like "08:00-09:50")
   - 3-hour courses: MUST be scheduled on Sunday, Tuesday, Thursday at the SAME time slot for all three days (e.g., all at "08:00-08:50")
   - 1-hour courses: Schedule on 1 day
4. **Tutorials**: 
   - For 2-hour lecture courses: MUST be scheduled on a DIFFERENT day from the lecture, prefer early morning slots (08:00-11:50), minimize gaps (no breaks)
   - For other courses: Can be 1-hour or 2-hour blocks, preferably morning
5. **Labs**: Must be 2-hour afternoon blocks (after ${ruleSettings.labAfterHour}:00) - this is the only exception to early slots
6. **Balance**: Distribute workload evenly across the week, but prioritize early morning slots
7. **Gap Avoidance**: When scheduling multiple sessions on the same day, place them back-to-back or with minimal gaps (1 hour max)
8. **Patterns**: Keep consistent timing for same activity type when possible, and make it early

  **OUTPUT FORMAT:**
Respond ONLY with valid JSON (no markdown, no code blocks, no explanatory text before or after). Start with { and end with }. Structure:
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
    
    // Remove markdown code blocks if present
    if (responseText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\s*/, '').replace(/```\s*$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\s*/, '').replace(/```\s*$/, '');
    }
    
    // Extract JSON from text that might have explanatory text before/after
    // Look for the first { and last } to extract JSON object
    const firstBrace = jsonText.indexOf('{');
    const lastBrace = jsonText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonText = jsonText.substring(firstBrace, lastBrace + 1);
    }
    
    // Try to clean up any remaining text markers
    jsonText = jsonText.trim();
    
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
  ${courses.map(c => {
    // For 2-hour courses, schedule as 1 continuous 2-hour lecture
    const lectureSessions = c.lecture_hours === 2 ? 1 : Math.ceil(c.lecture_hours);
    const lectureDesc = c.lecture_hours === 2 
      ? `${c.lecture_hours} hours → 1 continuous 2-hour lecture (use 2-hour slots)`
      : `${c.lecture_hours} hours → ${lectureSessions} session(s)`;
    return `
  - ${c.course_code} (${c.course_name})
    * Lectures: ${lectureDesc}
    * Tutorials: ${c.tutorial_hours} hours → ${Math.ceil(c.tutorial_hours)} sessions
    * Labs: ${c.lab_hours} hours → ${calculateLabSessions(c.lab_hours, c.course_code)} sessions
  `;
  }).join('\n')}
  
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
  -midterm slots in wednesday and monday: 12:00-13:50 (blocked)
    - Labs must be after ${ruleSettings.labAfterHour}:00 (afternoon only - exception to early slot rule)
  - **TIME PRIORITY**: Always prefer EARLY MORNING slots (08:00-11:50) over afternoon (13:00-14:50)
  - **GAP MINIMIZATION**: When multiple classes on same day, schedule them consecutively or with minimal gaps (1 hour max)
  - **2-HOUR COURSES**: 
    * Lecture: MUST be scheduled as 1 continuous 2-hour lecture (use 2-hour time slots like "08:00-09:50")
    * Tutorial: MUST be on a DIFFERENT day from lecture, prefer early slots (08:00-11:50), no breaks
  - **3-HOUR COURSES**: MUST be scheduled on Sunday, Tuesday, Thursday at the SAME time slot for all three days (e.g., all at "08:00-08:50" or all at "09:00-09:50")
  - Max ${ruleSettings.maxDailyHours} hours per day per group
  
  **STRICT REQUIREMENTS:**
  - Never schedule over existing other department courses
  - Never convert between lecture/tutorial/lab
  - Never add extra sessions
  - Never miss required sessions
  
  **OUTPUT FORMAT (MUST BE VALID JSON ONLY - NO TEXT BEFORE OR AFTER):**
  Start your response directly with the opening brace {. Do not include any explanatory text. Structure:
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
      
      // Remove markdown code blocks if present
      if (responseText.startsWith('```json')) {
        responseText = responseText.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (responseText.startsWith('```')) {
        responseText = responseText.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Extract JSON from text that might have explanatory text before/after
      // Look for the first { and last } to extract JSON object
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        responseText = responseText.substring(firstBrace, lastBrace + 1);
      }
      
      // Try to clean up any remaining text markers
      responseText = responseText.trim();
      
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
  // Calculate globally unique section base for completion
  // Use the same formula as main generation: 50000 + (level - 3) * 1000 + (groupNum - 1) * 100
  // This ensures consistency with the main generation logic
  let sectionBase = 50000 + (level - 3) * 1000 + (groupNum - 1) * 100;
  
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
    
    // Assign section numbers for this course
    const lectureSectionNum = sectionBase;      // Lectures get sectionBase
    const tutorialSectionNum = sectionBase + 1; // Tutorials get sectionBase + 1
    const labSectionNum = sectionBase + 2;      // Labs get sectionBase + 2
    
    // Complete missing lectures
    // For 3-hour courses, must schedule all three at the same time slot
    if (course.lecture_hours === 3 && req.required_lectures === 3) {
      const pattern = getLecturePattern(3); // Should be ["Sunday", "Tuesday", "Thursday"]
      const slots = ONE_HOUR_SLOTS.sort((a, b) => {
        const aHour = parseInt(a.split(":")[0]);
        const bHour = parseInt(b.split(":")[0]);
        if (aHour < 12 && bHour >= 12) return -1;
        if (aHour >= 12 && bHour < 12) return 1;
        return aHour - bHour;
      });
      
      // Try to find a time slot that works for all three days
      for (const time of slots) {
        const canScheduleAll = pattern.every(day => {
          if (ruleSettings.blockedDays.includes(day)) return false;
          if (ruleSettings.lunchBreaks.includes(time)) return false;
          const key = `${day}-${time}`;
          return !usedSlots.has(key);
        });
        
        if (canScheduleAll) {
          // Schedule all three days at the same time
          for (const day of pattern) {
            const key = `${day}-${time}`;
            completed.push({
              course_code: req.course_code,
              course_name: course.course_name,
              activity_type: "Lecture",
              section_num: lectureSectionNum,
              day,
              time_slot: time,
              hours: 1
            });
            usedSlots.add(key);
            current.lectures++;
          }
          console.log(`   ➕ Added missing 3L lectures for ${req.course_code} at ${time} on ${pattern.join(', ')}`);
          break; // Done - scheduled all three
        }
      }
      
      if (current.lectures < req.required_lectures) {
        console.warn(`   ⚠️ Could not find same time slot for 3L course ${req.course_code} on ${pattern.join(', ')}`);
      }
    } else {
      // For 2-hour and other courses, use normal completion
      while (current.lectures < req.required_lectures) {
        const lectureHours = course.lecture_hours === 2 ? 2 : 1;
        const newSession = findAvailableSlot("Lecture", lectureHours, usedSlots, ruleSettings, lectureSectionNum);
        if (newSession) {
          completed.push({
            ...newSession,
            course_code: req.course_code,
            course_name: course.course_name,
            section_num: lectureSectionNum
          });
          current.lectures++;
          console.log(`   ➕ Added missing ${lectureHours}h lecture for ${req.course_code} with section ${lectureSectionNum}`);
        } else {
          console.warn(`   ⚠️ Could not find slot for missing lecture in ${req.course_code}`);
          break;
        }
      }
    }
    
    // Complete missing tutorials
    // For 2L courses, avoid scheduling tutorial on same day as lecture
    const lectureDays = new Set(generated.filter(a => a.course_code === req.course_code && a.activity_type === "Lecture").map(a => a.day));
    const is2LCourse = course.lecture_hours === 2;
    
    while (current.tutorials < req.required_tutorials) {
      const hoursNeeded = course.tutorial_hours === 2 ? 2 : 1;
      
      // Try to find slot on different day from lecture (for 2L), prioritize early slots
      let newSession = null;
      const sortedDays = [...DAYS].sort((a, b) => {
        // For 2L, prioritize days that are NOT lecture days
        if (is2LCourse) {
          if (lectureDays.has(a) && !lectureDays.has(b)) return 1;
          if (!lectureDays.has(a) && lectureDays.has(b)) return -1;
        }
        return 0;
      });
      
      for (const day of sortedDays) {
        if (is2LCourse && lectureDays.has(day)) continue; // Skip lecture day for 2L
        if (ruleSettings.blockedDays.includes(day)) continue;
        
        const slots = hoursNeeded === 2 ? TWO_HOUR_SLOTS : ONE_HOUR_SLOTS;
        const sortedSlots = [...slots].sort((a, b) => {
          const aHour = parseInt(a.split(":")[0]);
          const bHour = parseInt(b.split(":")[0]);
          if (aHour < 12 && bHour >= 12) return -1; // Early slots first
          if (aHour >= 12 && bHour < 12) return 1;
          return aHour - bHour;
        });
        
        for (const time of sortedSlots) {
          if (ruleSettings.lunchBreaks.includes(time)) continue;
          const key = `${day}-${time}`;
          if (!usedSlots.has(key)) {
            const hours = time.includes("09:50") || time.includes("10:50") || time.includes("14:50") ? 2 : 1;
            if (hours === hoursNeeded && isSlotValid(day, time, hours, usedSlots, ruleSettings, "Tutorial")) {
              newSession = {
                activity_type: "Tutorial",
                section_num: tutorialSectionNum,
                day,
                time_slot: time,
                hours
              };
              usedSlots.add(key);
              break;
            }
          }
        }
        if (newSession) break;
      }
      
      if (newSession) {
        completed.push({
          ...newSession,
          course_code: req.course_code,
          course_name: course.course_name,
          section_num: tutorialSectionNum,
          activity_type: "Tutorial" as const
        });
        current.tutorials++;
        console.log(`   ➕ Added missing tutorial for ${req.course_code} on ${newSession.day} with section ${tutorialSectionNum}`);
      } else {
        console.warn(`   ⚠️ Could not find slot for missing tutorial in ${req.course_code}`);
        break;
      }
    }
    
    // Complete missing labs
    // For courses with multiple lab sessions (like SWE444), schedule on different days
    const requiredLabSessions = calculateLabSessions(course.lab_hours, course.course_code);
    const scheduledLabDays = new Set(generated.filter(a => a.course_code === req.course_code && a.activity_type === "Lab").map(a => a.day));
    
    while (current.labs < req.required_labs) {
      const hoursNeeded = course.lab_hours >= 2 ? 2 : 1;
      let newSession = null;
      
      // Try to find slot on different day from existing lab sessions (if multiple sessions required)
      for (const day of DAYS) {
        if (ruleSettings.blockedDays.includes(day)) continue;
        // Skip days where we already scheduled a lab for this course (if multiple sessions needed)
        if (requiredLabSessions > 1 && scheduledLabDays.has(day)) continue;
        
        const slots = TWO_HOUR_SLOTS.filter(time => {
          const startHour = parseInt(time.split(":")[0]);
          return startHour >= ruleSettings.labAfterHour;
        });
        
        const sortedSlots = [...slots].sort((a, b) => {
          const aHour = parseInt(a.split(":")[0]);
          const bHour = parseInt(b.split(":")[0]);
          if (aHour < 12 && bHour >= 12) return -1;
          if (aHour >= 12 && bHour < 12) return 1;
          return aHour - bHour;
        });
        
        for (const time of sortedSlots) {
          if (ruleSettings.lunchBreaks.includes(time)) continue;
          const key = `${day}-${time}`;
          if (!usedSlots.has(key)) {
            const hours = time.includes("09:50") || time.includes("10:50") || time.includes("14:50") ? 2 : 1;
            if (hours === hoursNeeded && isSlotValid(day, time, hours, usedSlots, ruleSettings, "Lab")) {
              newSession = {
                activity_type: "Lab",
                section_num: labSectionNum,
                day,
                time_slot: time,
                hours
              };
              usedSlots.add(key);
              scheduledLabDays.add(day);
              break;
            }
          }
        }
        if (newSession) break;
      }
      
      if (newSession) {
        completed.push({
          ...newSession,
          course_code: req.course_code,
          course_name: course.course_name,
          section_num: labSectionNum,
          activity_type: "Lab" as const
        });
        current.labs++;
        console.log(`   ➕ Added missing lab for ${req.course_code} on ${newSession.day} with section ${labSectionNum}`);
      } else {
        console.warn(`   ⚠️ Could not find slot for missing lab in ${req.course_code}`);
        break;
      }
    }
    
    // Move to next course (each course gets 3 section numbers)
    sectionBase += 3;
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
    midtermSlots: [] as Array<{ day: string; startTime: string; endTime: string }>, // Midterm time slots
  };
  
  // Block midterm slots: 12:00-14:00 on Monday and Wednesday (for lectures)
  settings.midtermSlots.push(
    { day: "Monday", startTime: "12:00", endTime: "14:00" },
    { day: "Wednesday", startTime: "12:00", endTime: "14:00" }
  );

  for (const r of rules) {
    const desc = r.rule_description.toLowerCase();
    // Normalize: strip punctuation for robust keyword detection
    const normalized = desc.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
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
    // Backward compatible: "no class <day>"
    for (const day of DAYS)
      if (desc.includes("no class") && desc.includes(day.toLowerCase()))
        settings.blockedDays.push(day);

    // Enhanced blocked-day detection: support many phrasings and abbreviations
    const blockedIntentKeywords = [
      "no class", "no classes", "day off", "off day", "off-day",
      "holiday", "holidays", "free day", "keep", "free",
      "no lectures", "no tutorials", "no labs", "no sessions",
      "without class", "without classes", "block", "blocked", "blackout", "black out"
    ];

    const dayAliases: Record<string, string[]> = {
      Sunday: ["sunday", "sun"],
      Monday: ["monday", "mon"],
      Tuesday: ["tuesday", "tue", "tues"],
      Wednesday: ["wednesday", "wed", "weds"],
      Thursday: ["thursday", "thu", "thur", "thurs"],
    };

    const mentionedDays: string[] = [];
    for (const day of DAYS) {
      const aliases = dayAliases[day] || [day.toLowerCase()];
      const isMentioned = aliases.some(a => new RegExp(`\\b${a}\\b`, "i").test(normalized));
      if (isMentioned) mentionedDays.push(day);
    }

    const hasBlockedIntent = blockedIntentKeywords.some(k => normalized.includes(k));
    const explicitDayOff = DAYS.some(day => {
      const d = day.toLowerCase();
      return (
        new RegExp(`\\b${d}\\b\\s*(is\\s*)?(a\\s*)?(day\\s*)?off\\b`).test(normalized) ||
        new RegExp(`\\boff\\b.*\\b${d}\\b`).test(normalized)
      );
    });

    if ((hasBlockedIntent || explicitDayOff) && mentionedDays.length > 0) {
      for (const day of mentionedDays) {
        if (!settings.blockedDays.includes(day)) settings.blockedDays.push(day);
      }
    }
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
    ruleSettings,
    groupNum, // ← Pass group number for section calculation
    level // ← Pass level for global uniqueness
  );

// ✅ ADD VALIDATION AND COMPLETION
    console.log(`🔍 Validating and enforcing exact session counts for Group ${groupNum}...`);
    // First, remove any extra sessions beyond required counts
    generated = enforceExactSessionCounts(generated, exactReqs);
    // Then validate
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
          ruleSettings,
          group, // ← Pass group number for section calculation
          level // ← Pass level for global uniqueness
        );
        
        console.log(`✨ AI generated ${generated.length} sessions`);
      } catch (aiError) {
        console.warn('⚠️ AI generation failed, using fallback algorithm');
        generated = generateScheduleFallback(courses, occupied, ruleSettings, group, level);
      }
    } else {
      console.log('🔧 Using traditional algorithm...');
      generated = generateScheduleFallback(courses, occupied, ruleSettings, group, level);
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
    console.log(`🔍 Validating and enforcing exact session counts for Group ${group}...`);
    // First, remove any extra sessions beyond required counts
    generated = enforceExactSessionCounts(generated, exactReqs);
    // Then validate
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
  ruleSettings: ReturnType<typeof parseRules>,
  groupNum: number, // Add group number parameter
  level: number // Add level parameter for global uniqueness
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  const used = new Set(occupied); // Start with occupied slots
  // Calculate globally unique section base
  // Formula: 50000 + (level - 3) * 1000 + (groupNum - 1) * 100 + (courseIndex * 3)
  // This ensures uniqueness across all levels, groups, and courses
  let sectionBase = 50000 + (level - 3) * 1000 + (groupNum - 1) * 100;

  // Group suggestions by course code first
  const courseSuggestions = new Map<string, GeminiScheduleSuggestion[]>();
  for (const suggestion of suggestions) {
    if (!courseSuggestions.has(suggestion.course_code)) {
      courseSuggestions.set(suggestion.course_code, []);
    }
    courseSuggestions.get(suggestion.course_code)!.push(suggestion);
  }

  // Process each course
  for (const [courseCode, courseSuggestionsList] of Array.from(courseSuggestions.entries())) {
    const course = courses.find(c => c.course_code === courseCode);
    if (!course) continue;

    // Track assignments by day for gap minimization across all activity types for this course
    const dayAssignments = new Map<string, ScheduleAssignment[]>();
    
    // For 3L courses, collect all lecture sessions first to validate same time slot
    const is3LCourse = course.lecture_hours === 3;
    const lectureSessions: any[] = [];
    const otherSuggestions: GeminiScheduleSuggestion[] = [];

    // Process each activity type for this course
    for (const suggestion of courseSuggestionsList) {
      if (is3LCourse && suggestion.activity_type === "Lecture") {
        // Collect lecture sessions for 3L courses to validate
        lectureSessions.push(...suggestion.sessions);
      } else {
        otherSuggestions.push(suggestion);
      }
    }
    
    // Process lecture sessions for 3L courses separately
    if (is3LCourse && lectureSessions.length > 0) {
      // Find all unique time slots used for lectures
      const timeSlotsUsed = new Set<string>();
      const lectureAssignments: ScheduleAssignment[] = [];
      const pattern = getLecturePattern(3); // ["Sunday", "Tuesday", "Thursday"]
      
      // Group sessions by time slot
      const sessionsByTime = new Map<string, any[]>();
      for (const session of lectureSessions) {
        if (!sessionsByTime.has(session.time_slot)) {
          sessionsByTime.set(session.time_slot, []);
        }
        sessionsByTime.get(session.time_slot)!.push(session);
      }
      
      // Find a time slot that has sessions for all three days (Sunday, Tuesday, Thursday)
      let selectedTime: string | null = null;
      for (const [time, sessions] of Array.from(sessionsByTime.entries())) {
        const days = new Set(sessions.map((s: any) => s.day));
        if (pattern.every(day => days.has(day))) {
          selectedTime = time;
          break;
        }
      }
      
      // If no time slot has all three days, use the most common time slot
      if (!selectedTime && sessionsByTime.size > 0) {
        let maxCount = 0;
        for (const [time, sessions] of Array.from(sessionsByTime.entries())) {
          if (sessions.length > maxCount) {
            maxCount = sessions.length;
            selectedTime = time;
          }
        }
      }
      
      // Process sessions for 3L course - only accept sessions at the selected time slot
      const currentSectionNum = sectionBase; // Lecture section
      for (const session of lectureSessions) {
        // Only accept sessions at the selected time slot and on correct days
        if (selectedTime && session.time_slot === selectedTime && pattern.includes(session.day)) {
          const key = `${session.day}-${session.time_slot}`;
          
          if (used.has(key)) {
            console.log(`⏭️ Skipping occupied slot: ${key}`);
            continue;
          }
          
          if (!isSlotValid(session.day, session.time_slot, 1, used, ruleSettings, "Lecture")) {
            continue;
          }
          
          const assignment: ScheduleAssignment = {
            course_code: courseCode,
            course_name: course.course_name,
            activity_type: "Lecture",
            section_num: currentSectionNum,
            day: session.day,
            time_slot: session.time_slot,
            hours: 1,
          };
          
          lectureAssignments.push(assignment);
          
          if (!dayAssignments.has(session.day)) {
            dayAssignments.set(session.day, []);
          }
          dayAssignments.get(session.day)!.push(assignment);
          
          used.add(key);
          timeSlotsUsed.add(session.time_slot);
        } else {
          console.log(`⚠️ Skipping 3L lecture session for ${courseCode} on ${session.day} at ${session.time_slot} (must be at same time slot for all days)`);
        }
      }
      
      // Validate that all three days are scheduled
      const scheduledDays = new Set(lectureAssignments.map(a => a.day));
      if (scheduledDays.size !== 3 || !pattern.every(day => scheduledDays.has(day))) {
        console.warn(`⚠️ 3L course ${courseCode} is missing sessions on some days. Scheduled: ${Array.from(scheduledDays).join(', ')}, Required: ${pattern.join(', ')}`);
      }
      
      assignments.push(...lectureAssignments);
    }

    // Process other activity types (Tutorial, Lab) and non-3L lectures
    const suggestionsToProcess = is3LCourse ? otherSuggestions : courseSuggestionsList;
    for (const suggestion of suggestionsToProcess) {
      // Sort sessions by priority first, then by time (early morning first)
      const sortedSessions = suggestion.sessions.sort((a: any, b: any) => {
        // First sort by priority (higher priority first)
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        // Then sort by time (early morning first)
        const aHour = parseInt(a.time_slot.split(":")[0]);
        const bHour = parseInt(b.time_slot.split(":")[0]);
        if (aHour < 12 && bHour >= 12) return -1; // Morning before afternoon
        if (aHour >= 12 && bHour < 12) return 1;
        return aHour - bHour;
      });

      // Calculate section number based on activity type (same for all sessions of this activity type)
      let currentSectionNum = sectionBase; // Lecture
      if (suggestion.activity_type === "Tutorial") {
        currentSectionNum = sectionBase + 1; // Tutorial
      } else if (suggestion.activity_type === "Lab") {
        currentSectionNum = sectionBase + 2; // Lab
      }

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
        
        // For 2-hour courses, enforce that lectures must be 2-hour blocks
        if (suggestion.activity_type === "Lecture" && course.lecture_hours === 2 && hours !== 2) {
          console.log(`⚠️ Skipping ${suggestion.activity_type} session for ${courseCode} - must be 2-hour block (got ${hours}h)`);
          continue;
        }
        
        // For labs, enforce exact session count - 2 lab hours = 1 session only
        if (suggestion.activity_type === "Lab") {
          const requiredLabSessions = calculateLabSessions(course.lab_hours, course.course_code);
          const currentLabCount = assignments.filter(a => a.course_code === courseCode && a.activity_type === "Lab").length;
          
          // If we already have the required number of lab sessions, skip additional ones
          if (currentLabCount >= requiredLabSessions) {
            console.log(`⚠️ Skipping extra lab session for ${courseCode} - already have ${currentLabCount}/${requiredLabSessions} required`);
            continue;
          }
          
          // For 2-hour labs, must be 2-hour block
          if (course.lab_hours === 2 && hours !== 2) {
            console.log(`⚠️ Skipping lab session for ${courseCode} - must be 2-hour block (got ${hours}h)`);
            continue;
          }
        }

        // Check gap minimization: if we have existing assignments on this day, prefer consecutive slots
        const existingOnDay = dayAssignments.get(session.day) || [];
        if (existingOnDay.length > 0 && suggestion.activity_type !== "Lab") {
          // For non-labs, check if this slot is consecutive (gap <= 1 hour)
          const latestEnd = Math.max(...existingOnDay.map(a => {
            const start = parseInt(a.time_slot.split(":")[0]);
            return start + (a.hours === 2 ? 2 : 1);
          }));
          const timeStart = parseInt(session.time_slot.split(":")[0]);
          const gap = timeStart - latestEnd;
          
          // If gap is more than 1 hour, skip and try other slots first (they're already sorted by priority and time)
          if (gap > 1) {
            continue; // Will try other slots that might fit better
          }
        }

        if (!isSlotValid(session.day, session.time_slot, hours, used, ruleSettings, suggestion.activity_type as any)) {
          continue;
        }

        const assignment: ScheduleAssignment = {
          course_code: suggestion.course_code,
          course_name: course.course_name,
          activity_type: suggestion.activity_type as any,
          section_num: currentSectionNum, // Same section number for all sessions of this activity type
          day: session.day,
          time_slot: session.time_slot,
          hours,
        };

        assignments.push(assignment);
        
        // Track assignments by day for gap minimization
        if (!dayAssignments.has(session.day)) {
          dayAssignments.set(session.day, []);
        }
        dayAssignments.get(session.day)!.push(assignment);

        used.add(key);
      }
    }
    
    // Increment section base for the next course (each course gets 3 section numbers)
    sectionBase += 3;
  }

  return assignments;
}
function isSlotValid(
  day: string,
  time: string,
  hours: number,
  used: Set<string>,
  ruleSettings: ReturnType<typeof parseRules>,
  activityType?: "Lecture" | "Tutorial" | "Lab" // Add activity type to check midterm slots for lectures only
): boolean {
  const key = `${day}-${time}`;
  if (used.has(key)) return false;
  if (ruleSettings.lunchBreaks.includes(time)) return false;
  if (ruleSettings.blockedDays.includes(day)) return false;
  
  // Block midterm slots (12:00-14:00) on Monday and Wednesday for lectures only
  if (activityType === "Lecture") {
    const startHour = parseInt(time.split(":")[0]);
    const timeStart = parseInt(time.split(":")[0]);
    const timeEnd = time.includes("09:50") || time.includes("10:50") || time.includes("14:50") 
      ? timeStart + 2 
      : timeStart + 1;
    
    for (const midtermSlot of ruleSettings.midtermSlots || []) {
      if (midtermSlot.day === day) {
        const midtermStart = parseInt(midtermSlot.startTime.split(":")[0]);
        const midtermEnd = parseInt(midtermSlot.endTime.split(":")[0]);
        // Check if the slot overlaps with midterm time (12:00-14:00)
        if ((timeStart >= midtermStart && timeStart < midtermEnd) || 
            (timeEnd > midtermStart && timeEnd <= midtermEnd) ||
            (timeStart < midtermStart && timeEnd > midtermEnd)) {
          return false; // Block lectures during midterm time
        }
      }
    }
  }
  
  const startHour = parseInt(time.split(":")[0]);
  if (startHour < 8 || startHour > 14) return false;
  return true;
}

// ─── FALLBACK GENERATION ──────────────────────────────────────
function generateScheduleFallback(
  courses: Course[],
  occupied: Set<string>,
  ruleSettings: ReturnType<typeof parseRules>,
  groupNum: number,
  level: number
): ScheduleAssignment[] {
  const result: ScheduleAssignment[] = [];
  const used = new Set(occupied);
  const dailyHours: Record<string, number> = {};
  // Calculate globally unique section base
  // Formula: 50000 + (level - 3) * 1000 + (groupNum - 1) * 100 + (courseIndex * 3)
  // This ensures uniqueness across all levels, groups, and courses
  let sectionBase = 50000 + (level - 3) * 1000 + (groupNum - 1) * 100;

  const sortedCourses = [...courses].sort((a, b) => {
    const totalA = a.lecture_hours + a.tutorial_hours + a.lab_hours;
    const totalB = b.lecture_hours + b.tutorial_hours + b.lab_hours;
    return totalB - totalA;
  });

  for (const course of sortedCourses) {
    if (course.lecture_hours > 0) {
      const lectures = scheduleLectures(course, used, dailyHours, ruleSettings, sectionBase);
      result.push(...lectures);
    }
    if (course.tutorial_hours > 0) {
      // For 2L courses, pass existing lectures to avoid same day
      const existingLectures = result.filter(a => a.course_code === course.course_code && a.activity_type === "Lecture");
      const tutorials = scheduleTutorials(course, used, dailyHours, ruleSettings, sectionBase + 1, existingLectures);
      result.push(...tutorials);
    }
    if (course.lab_hours > 0) {
      const labs = scheduleLabs(course, used, dailyHours, ruleSettings, sectionBase + 2);
      result.push(...labs);
    }
    // Increment section base for the next course (each course gets 3 section numbers)
    sectionBase += 3;
  }
  return result;
}

function scheduleLectures(course: Course, used: Set<string>, dailyHours: Record<string, number>, ruleSettings: ReturnType<typeof parseRules>, sectionNum: number): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  
  // For 2-hour courses, schedule as 1 continuous 2-hour lecture
  if (course.lecture_hours === 2) {
    // Sort 2-hour slots to prioritize early morning (08:00-11:50) over afternoon (13:00-14:50)
    const sortedTwoHourSlots = [...TWO_HOUR_SLOTS].sort((a, b) => {
      const aHour = parseInt(a.split(":")[0]);
      const bHour = parseInt(b.split(":")[0]);
      if (aHour < 12 && bHour >= 12) return -1; // Morning before afternoon
      if (aHour >= 12 && bHour < 12) return 1;
      return aHour - bHour;
    });
    
    // Try to find an available 2-hour slot (prefer early morning)
    for (const day of DAYS) {
      if (ruleSettings.blockedDays.includes(day)) continue;
      
      for (const time of sortedTwoHourSlots) {
        if (isSlotAvailable(day, time, 2, used, dailyHours, ruleSettings, "Lecture")) {
          const key = `${day}-${time}`;
          assignments.push({
            course_code: course.course_code,
            course_name: course.course_name,
            activity_type: "Lecture",
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
    return assignments; // Return empty if no slot found
  }
  
  // For other courses, use the pattern-based scheduling
  const pattern = getLecturePattern(course.lecture_hours);
  
  // Sort time slots to prioritize early morning (08:00-11:50) over afternoon (13:00-14:50)
  const sortedOneHourSlots = [...ONE_HOUR_SLOTS].sort((a, b) => {
    const aHour = parseInt(a.split(":")[0]);
    const bHour = parseInt(b.split(":")[0]);
    if (aHour < 12 && bHour >= 12) return -1; // Morning before afternoon
    if (aHour >= 12 && bHour < 12) return 1;
    return aHour - bHour;
  });
  
  // For 3-hour courses (Sunday/Tuesday/Thursday), MUST schedule at the same time slot
  if (course.lecture_hours === 3 && pattern.length === 3) {
    // Try to schedule all three lectures at the same time slot
    for (const time of sortedOneHourSlots) {
      const canScheduleAll = pattern.every(day => isSlotAvailable(day, time, 1, used, dailyHours, ruleSettings, "Lecture"));
      if (canScheduleAll) {
        // Schedule all three days at the same time
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
        return assignments; // Success - all three days scheduled at same time
      }
    }
    // If no slot available for all three days, return empty (can't schedule)
    console.warn(`⚠️ Could not find same time slot for ${course.course_code} on ${pattern.join(', ')}`);
    return assignments; // Return empty if can't schedule all at same time
  }
  
  // For other courses, try to schedule at same time first
  for (const time of sortedOneHourSlots) {
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

  // Fallback for non-3L courses: Schedule individually, prioritizing early slots and minimizing gaps
  let hoursScheduled = 0;
  for (const day of pattern) {
    if (hoursScheduled >= course.lecture_hours) break;
    
    // Find existing sessions on this day to minimize gaps
    const existingOnDay = assignments.filter(a => a.day === day);
    const latestHour = existingOnDay.length > 0 
      ? Math.max(...existingOnDay.map(a => {
          const start = parseInt(a.time_slot.split(":")[0]);
          return start + (a.hours === 2 ? 2 : 1);
        }))
      : -1;
    
    for (const time of sortedOneHourSlots) {
      if (isSlotAvailable(day, time, 1, used, dailyHours, ruleSettings, "Lecture")) {
        const timeStart = parseInt(time.split(":")[0]);
        
        // If we have existing sessions, prefer consecutive slots (gap <= 1 hour)
        if (latestHour >= 0) {
          const gap = timeStart - latestHour;
          if (gap > 1) continue; // Skip if gap is more than 1 hour
        }
        
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

function scheduleTutorials(course: Course, used: Set<string>, dailyHours: Record<string, number>, ruleSettings: ReturnType<typeof parseRules>, sectionNum: number, existingLectures: ScheduleAssignment[] = []): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  let hoursScheduled = 0;

  // For 2L courses, get the lecture day to avoid scheduling tutorial on same day
  const is2LCourse = course.lecture_hours === 2;
  const lectureDays = new Set(existingLectures.filter(l => l.course_code === course.course_code).map(l => l.day));
  
  // Sort slots to prioritize early morning (08:00-11:50) over afternoon (13:00-14:50)
  const sortedTwoHourSlots = [...TWO_HOUR_SLOTS].sort((a, b) => {
    const aHour = parseInt(a.split(":")[0]);
    const bHour = parseInt(b.split(":")[0]);
    if (aHour < 12 && bHour >= 12) return -1;
    if (aHour >= 12 && bHour < 12) return 1;
    return aHour - bHour;
  });
  
  const sortedOneHourSlots = [...ONE_HOUR_SLOTS].sort((a, b) => {
    const aHour = parseInt(a.split(":")[0]);
    const bHour = parseInt(b.split(":")[0]);
    if (aHour < 12 && bHour >= 12) return -1;
    if (aHour >= 12 && bHour < 12) return 1;
    return aHour - bHour;
  });

  if (course.tutorial_hours === 2) {
    // Prefer early morning 2-hour slots, avoid lecture day for 2L courses
    for (const day of DAYS) {
      if (is2LCourse && lectureDays.has(day)) continue; // Skip lecture day for 2L courses
      if (ruleSettings.blockedDays.includes(day)) continue;
      
      for (const time of sortedTwoHourSlots) {
        if (isSlotAvailable(day, time, 2, used, dailyHours, ruleSettings, "Tutorial")) {
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

  // For 1-hour tutorials, schedule on different day from lecture (for 2L) and minimize gaps
  for (const day of DAYS) {
    if (hoursScheduled >= course.tutorial_hours) break;
    if (is2LCourse && lectureDays.has(day)) continue; // Skip lecture day for 2L courses
    if (ruleSettings.blockedDays.includes(day)) continue;
    
    // Check existing sessions on this day to minimize gaps
    const existingOnDay = assignments.filter(a => a.day === day);
    const latestHour = existingOnDay.length > 0 
      ? Math.max(...existingOnDay.map(a => {
          const start = parseInt(a.time_slot.split(":")[0]);
          return start + (a.hours === 2 ? 2 : 1);
        }))
      : -1;
    
    for (const time of sortedOneHourSlots) {
      if (hoursScheduled >= course.tutorial_hours) break;
      
      const timeStart = parseInt(time.split(":")[0]);
      
      // Prefer consecutive slots (no break) - gap should be 0 or 1 hour max
      if (latestHour >= 0 && timeStart - latestHour > 1) continue;
      
      if (isSlotAvailable(day, time, 1, used, dailyHours, ruleSettings, "Lecture")) {
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
  
  // Calculate how many 2-hour sessions needed
  const requiredLabSessions = calculateLabSessions(course.lab_hours, course.course_code);
  
  // Track which days we've already scheduled labs for this course (to avoid same day for multiple sessions)
  const scheduledDays = new Set<string>();
  
  // Labs are always 2-hour blocks, so we schedule requiredLabSessions number of 2-hour sessions
  // For courses like SWE444 (2 sessions), schedule on DIFFERENT days
  for (let i = 0; i < requiredLabSessions; i++) {
    let sessionScheduled = false;
    
    // Try each day, but skip days where we already scheduled a lab for this course
    for (const day of DAYS) {
      if (ruleSettings.blockedDays.includes(day)) continue;
      
      // Skip days where we already scheduled a lab session for this course
      if (requiredLabSessions > 1 && scheduledDays.has(day)) continue;
      
      for (const time of TWO_HOUR_SLOTS) {
        const startHour = parseInt(time.split(":")[0]);
        if (startHour < ruleSettings.labAfterHour) continue;
        
        if (isSlotAvailable(day, time, 2, used, dailyHours, ruleSettings, "Lab")) {
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
          scheduledDays.add(day); // Mark this day as used for this course
          sessionScheduled = true;
          break; // Found a slot for this session, move to next
        }
      }
      if (sessionScheduled) break; // Found a slot for this session, move to next session
    }
  }
  
  return assignments;
}

function getLecturePattern(hours: number): string[] {
  if (hours >= 3) return ["Sunday", "Tuesday", "Thursday"];
  if (hours === 2) return ["Monday", "Wednesday"];
  return ["Sunday"];
}

function isSlotAvailable(day: string, time: string, hours: number, used: Set<string>, dailyHours: Record<string, number>, ruleSettings: ReturnType<typeof parseRules>, activityType?: "Lecture" | "Tutorial" | "Lab"): boolean {
  const key = `${day}-${time}`;
  const startHour = parseInt(time.split(":")[0]);
  if (used.has(key)) return false;
  if (ruleSettings.lunchBreaks.includes(time)) return false;
  if (ruleSettings.blockedDays.includes(day)) return false;
  
  // Block midterm slots (12:00-14:00) on Monday and Wednesday for lectures only
  if (activityType === "Lecture") {
    const timeStart = parseInt(time.split(":")[0]);
    const timeEnd = time.includes("09:50") || time.includes("10:50") || time.includes("14:50") 
      ? timeStart + 2 
      : timeStart + 1;
    
    for (const midtermSlot of ruleSettings.midtermSlots || []) {
      if (midtermSlot.day === day) {
        const midtermStart = parseInt(midtermSlot.startTime.split(":")[0]);
        const midtermEnd = parseInt(midtermSlot.endTime.split(":")[0]);
        // Check if the slot overlaps with midterm time (12:00-14:00)
        if ((timeStart >= midtermStart && timeStart < midtermEnd) || 
            (timeEnd > midtermStart && timeEnd <= midtermEnd) ||
            (timeStart < midtermStart && timeEnd > midtermEnd)) {
          return false; // Block lectures during midterm time
        }
      }
    }
  }
  
  if ((dailyHours[day] || 0) + hours > ruleSettings.maxDailyHours) return false;
  if (startHour < 8 || startHour > 14) return false;
  return true;
}

