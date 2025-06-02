export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  kuerzel?: string;
  employeeType: 'ausgelernt' | 'azubi';
  lehrjahr?: number;
  grade: number; // Percentage (1-100)
  teamId: string;
  specificShiftPercentage?: number; // Optional override for team percentage
  allowedShifts: string[]; // Array of shift type IDs
  availability: Record<string, boolean>; // e.g. {"monday_AM": true, "monday_PM": false}
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  overallShiftPercentage: number; // Percentage (0-100)
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftType {
  id: string;
  name: string;
  startTime: string; // Format: "HH:MM"
  endTime: string; // Format: "HH:MM"
  weeklyNeeds: Record<string, number>; // e.g. {"monday": 2, "tuesday": 1}
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningYearQualification {
  id: string; // "1", "2", "3", "4"
  jahr: number; // 1, 2, 3, or 4
  qualifiedShiftTypes: string[]; // Array of shift type IDs
  defaultAvailability: Record<string, boolean>; // Default availability for this learning year
  updatedAt: Date;
}

export interface ShiftRule {
  id: string;
  type: 'forbidden_sequence' | 'mandatory_follow_up';
  name: string;
  fromShiftId: string;
  toShiftId?: string; // For mandatory_follow_up
  toShiftIds?: string[]; // For forbidden_sequence (multiple targets)
  sameDay?: boolean; // For forbidden_sequence rules
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftAssignment {
  employeeId: string;
  shiftId: string;
  date: string; // ISO date string
  locked: boolean;
  isFollowUp?: boolean;
}

export interface ShiftPlan {
  id: string;
  planName?: string;
  startDate: Date;
  endDate: Date;
  assignments: ShiftAssignment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DayShiftNeed {
  shiftTypeId: string;
  count: number;
}

export interface WorkloadStats {
  hours: number;
  shifts: number;
  targetPercentage: number;
  daysWorkedThisPeriod: Record<string, boolean>;
}

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
export type HalfDay = 'AM' | 'PM';

export const WEEKDAYS: WeekDay[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
export const WEEKDAYS_GERMAN: Record<WeekDay, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag'
};
export const WEEKDAYS_SHORT: Record<WeekDay, string> = {
  monday: 'Mo',
  tuesday: 'Di',
  wednesday: 'Mi',
  thursday: 'Do',
  friday: 'Fr'
};
export const HALF_DAYS: HalfDay[] = ['AM', 'PM'];
export const HALF_DAYS_GERMAN: Record<HalfDay, string> = {
  AM: 'VM',
  PM: 'NM'
};
