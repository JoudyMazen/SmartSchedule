// Shared types for the SmartSchedule application

export interface ScheduleEntry {
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
}

export interface TimeSlot {
  time_slot: string;
}

export interface Day {
  day: string;
}

export interface Course {
  course_code: string;
  course_name: string;
}

export interface SessionInput {
  day: string;
  time_slot: string;
}

export interface AlertState {
  type: 'success' | 'danger' | 'warning';
  message: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface GroupsResponse {
  success: boolean;
  groups: number[];
  message?: string;
  error?: string;
}

export interface ScheduleResponse {
  success: boolean;
  entries?: ScheduleEntry[];
  message?: string;
  error?: string;
}
