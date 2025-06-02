import type {
  Employee,
  Team,
  ShiftType,
  LearningYearQualification,
  ShiftRule,
  ShiftAssignment,
  WorkloadStats,
  WeekDay,
  WEEKDAYS
} from './types';

export interface ScheduleOptions {
  startDate: Date;
  endDate: Date;
  employees: Employee[];
  teams: Team[];
  shiftTypes: ShiftType[];
  learningYearQualifications: LearningYearQualification[];
  shiftRules: ShiftRule[];
  existingAssignments?: ShiftAssignment[];
}

export interface ScheduleResult {
  assignments: ShiftAssignment[];
  conflicts: string[];
  statistics: {
    totalAssignments: number;
    unassignedShifts: number;
    employeeWorkloads: Record<string, WorkloadStats>;
  };
}

const WEEKDAY_MAPPING = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export class ShiftScheduler {
  private options: ScheduleOptions;
  private assignments: ShiftAssignment[];
  private conflicts: string[];
  private employeeWorkloads: Record<string, WorkloadStats>;

  constructor(options: ScheduleOptions) {
    this.options = options;
    this.assignments = [...(options.existingAssignments || [])];
    this.conflicts = [];
    this.employeeWorkloads = {};
    this.initializeWorkloads();
  }

  private initializeWorkloads(): void {
    for (const employee of this.options.employees) {
      const team = this.options.teams.find(t => t.id === employee.teamId);
      const effectivePercentage = employee.specificShiftPercentage ?? team?.overallShiftPercentage ?? 100;

      this.employeeWorkloads[employee.id] = {
        hours: 0,
        shifts: 0,
        targetPercentage: effectivePercentage,
        daysWorkedThisPeriod: {},
      };
    }

    // Calculate existing workload from existing assignments
    for (const assignment of this.assignments) {
      if (this.employeeWorkloads[assignment.employeeId]) {
        const shiftType = this.options.shiftTypes.find(st => st.id === assignment.shiftId);
        if (shiftType) {
          const duration = this.calculateShiftDuration(shiftType);
          this.employeeWorkloads[assignment.employeeId].hours += duration;
          this.employeeWorkloads[assignment.employeeId].shifts += 1;
          this.employeeWorkloads[assignment.employeeId].daysWorkedThisPeriod[assignment.date] = true;
        }
      }
    }
  }

  private calculateShiftDuration(shiftType: ShiftType): number {
    const [startH, startM] = shiftType.startTime.split(':').map(Number);
    const [endH, endM] = shiftType.endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    // Handle overnight shifts
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
    }

    return (endMinutes - startMinutes) / 60;
  }

  private getWeekdayName(date: Date): WeekDay | null {
    const dayIndex = date.getDay();
    const dayName = WEEKDAY_MAPPING[dayIndex] as WeekDay;
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(dayName) ? dayName : null;
  }

  private isEmployeeAvailable(employee: Employee, date: Date, shiftType: ShiftType): boolean {
    const weekday = this.getWeekdayName(date);
    if (!weekday) return false;

    const shiftStartHour = Number.parseInt(shiftType.startTime.split(':')[0]);
    const shiftEndHour = Number.parseInt(shiftType.endTime.split(':')[0]);

    // Check morning availability (before 12:00)
    if (shiftStartHour < 12) {
      const morningKey = `${weekday}_AM`;
      if (employee.availability[morningKey] === false) return false;
    }

    // Check afternoon/evening availability (12:00 and after)
    if (shiftEndHour >= 12 || (shiftStartHour >= 12 && shiftStartHour < 24)) {
      const afternoonKey = `${weekday}_PM`;
      if (employee.availability[afternoonKey] === false) return false;
    }

    // Handle overnight shifts
    if (shiftType.endTime < shiftType.startTime) {
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      const nextWeekday = this.getWeekdayName(nextDay);

      if (nextWeekday && shiftEndHour > 0 && shiftEndHour < 12) {
        const nextMorningKey = `${nextWeekday}_AM`;
        if (employee.availability[nextMorningKey] === false) return false;
      }
    }

    return true;
  }

  private isEmployeeQualified(employee: Employee, shiftType: ShiftType): boolean {
    // Check if employee has this shift in their allowed shifts
    if (!employee.allowedShifts.includes(shiftType.id)) return false;

    // For apprentices, check learning year qualifications
    if (employee.employeeType === 'azubi' && employee.lehrjahr) {
      const qualification = this.options.learningYearQualifications.find(q => q.jahr === employee.lehrjahr);
      if (!qualification || !qualification.qualifiedShiftTypes.includes(shiftType.id)) {
        return false;
      }
    }

    return true;
  }

  private hasShiftRuleConflict(employee: Employee, date: Date, shiftType: ShiftType): string | null {
    const dateStr = date.toISOString().split('T')[0];

    // Check forbidden sequence rules
    const forbiddenRules = this.options.shiftRules.filter(r => r.type === 'forbidden_sequence');

    for (const rule of forbiddenRules) {
      // Check same day forbidden sequences
      if (rule.sameDay) {
        const existingAssignment = this.assignments.find(a =>
          a.employeeId === employee.id &&
          a.date === dateStr &&
          a.shiftId === rule.fromShiftId
        );

        if (existingAssignment &&
            ((rule.toShiftIds && rule.toShiftIds.includes(shiftType.id)) ||
             rule.toShiftId === shiftType.id)) {
          return `Forbidden same-day sequence: ${rule.name}`;
        }
      } else {
        // Check next day forbidden sequences
        const previousDay = new Date(date);
        previousDay.setDate(date.getDate() - 1);
        const previousDateStr = previousDay.toISOString().split('T')[0];

        const previousAssignment = this.assignments.find(a =>
          a.employeeId === employee.id &&
          a.date === previousDateStr &&
          a.shiftId === rule.fromShiftId
        );

        if (previousAssignment &&
            ((rule.toShiftIds && rule.toShiftIds.includes(shiftType.id)) ||
             rule.toShiftId === shiftType.id)) {
          return `Forbidden next-day sequence: ${rule.name}`;
        }
      }
    }

    return null;
  }

  private checkMandatoryFollowUps(employee: Employee, date: Date, shiftType: ShiftType): ShiftType | null {
    const mandatoryRules = this.options.shiftRules.filter(r =>
      r.type === 'mandatory_follow_up' && r.fromShiftId === shiftType.id
    );

    for (const rule of mandatoryRules) {
      if (rule.toShiftId) {
        const followUpShiftType = this.options.shiftTypes.find(st => st.id === rule.toShiftId);
        if (followUpShiftType &&
            this.isEmployeeQualified(employee, followUpShiftType) &&
            this.isEmployeeAvailable(employee, date, followUpShiftType)) {
          return followUpShiftType;
        }
      }
    }

    return null;
  }

  private sortEmployeesByWorkload(): Employee[] {
    return [...this.options.employees].sort((a, b) => {
      const workloadA = this.employeeWorkloads[a.id];
      const workloadB = this.employeeWorkloads[b.id];

      // First sort by shift count, then by hours
      if (workloadA.shifts !== workloadB.shifts) {
        return workloadA.shifts - workloadB.shifts;
      }
      return workloadA.hours - workloadB.hours;
    });
  }

  private assignShift(employee: Employee, date: Date, shiftType: ShiftType, isFollowUp = false): boolean {
    const dateStr = date.toISOString().split('T')[0];

    // Check if slot is already occupied
    const existingAssignment = this.assignments.find(a =>
      a.date === dateStr &&
      a.shiftId === shiftType.id &&
      !a.isFollowUp
    );

    if (existingAssignment && !isFollowUp) return false;

    // Check if employee already has an assignment on this day
    const employeeExistingAssignment = this.assignments.find(a =>
      a.employeeId === employee.id &&
      a.date === dateStr &&
      !a.isFollowUp
    );

    if (employeeExistingAssignment && !isFollowUp) return false;

    // Create assignment
    const assignment: ShiftAssignment = {
      employeeId: employee.id,
      shiftId: shiftType.id,
      date: dateStr,
      locked: false,
      isFollowUp,
    };

    this.assignments.push(assignment);

    // Update workload
    const duration = this.calculateShiftDuration(shiftType);
    this.employeeWorkloads[employee.id].hours += duration;
    this.employeeWorkloads[employee.id].shifts += 1;
    this.employeeWorkloads[employee.id].daysWorkedThisPeriod[dateStr] = true;

    // Check for mandatory follow-ups
    const followUpShift = this.checkMandatoryFollowUps(employee, date, shiftType);
    if (followUpShift && !isFollowUp) {
      this.assignShift(employee, date, followUpShift, true);
    }

    return true;
  }

  public schedule(): ScheduleResult {
    this.conflicts = [];

    // Generate schedule for each day in the range
    const currentDate = new Date(this.options.startDate);

    while (currentDate <= this.options.endDate) {
      const weekday = this.getWeekdayName(currentDate);

      if (weekday) {
        this.scheduleDay(new Date(currentDate), weekday);
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      assignments: this.assignments,
      conflicts: this.conflicts,
      statistics: {
        totalAssignments: this.assignments.length,
        unassignedShifts: this.countUnassignedShifts(),
        employeeWorkloads: this.employeeWorkloads,
      },
    };
  }

  private scheduleDay(date: Date, weekday: WeekDay): void {
    const dateStr = date.toISOString().split('T')[0];

    // Get required shifts for this day
    const requiredShifts: { shiftType: ShiftType; count: number }[] = [];

    for (const shiftType of this.options.shiftTypes) {
      const need = shiftType.weeklyNeeds[weekday] || 0;
      if (need > 0) {
        requiredShifts.push({ shiftType, count: need });
      }
    }

    // Assign shifts
    for (const { shiftType, count } of requiredShifts) {
      const currentAssignments = this.assignments.filter(a =>
        a.date === dateStr &&
        a.shiftId === shiftType.id &&
        !a.isFollowUp
      ).length;

      const needed = count - currentAssignments;

      for (let i = 0; i < needed; i++) {
        const sortedEmployees = this.sortEmployeesByWorkload();
        let assigned = false;

        for (const employee of sortedEmployees) {
          // Skip if employee already has assignment this day (non-follow-up)
          const hasAssignment = this.assignments.some(a =>
            a.employeeId === employee.id &&
            a.date === dateStr &&
            !a.isFollowUp
          );

          if (hasAssignment) continue;

          // Check qualifications
          if (!this.isEmployeeQualified(employee, shiftType)) continue;

          // Check availability
          if (!this.isEmployeeAvailable(employee, date, shiftType)) continue;

          // Check shift rules
          const ruleConflict = this.hasShiftRuleConflict(employee, date, shiftType);
          if (ruleConflict) {
            this.conflicts.push(`${employee.firstName} ${employee.lastName} on ${dateStr}: ${ruleConflict}`);
            continue;
          }

          // Assign the shift
          if (this.assignShift(employee, date, shiftType)) {
            assigned = true;
            break;
          }
        }

        if (!assigned) {
          this.conflicts.push(`Unassigned shift: ${shiftType.name} on ${dateStr}`);
        }
      }
    }
  }

  private countUnassignedShifts(): number {
    let unassigned = 0;
    const currentDate = new Date(this.options.startDate);

    while (currentDate <= this.options.endDate) {
      const weekday = this.getWeekdayName(currentDate);
      const dateStr = currentDate.toISOString().split('T')[0];

      if (weekday) {
        for (const shiftType of this.options.shiftTypes) {
          const need = shiftType.weeklyNeeds[weekday] || 0;
          const assigned = this.assignments.filter(a =>
            a.date === dateStr &&
            a.shiftId === shiftType.id &&
            !a.isFollowUp
          ).length;

          unassigned += Math.max(0, need - assigned);
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return unassigned;
  }
}

export function generateShiftSchedule(options: ScheduleOptions): ScheduleResult {
  const scheduler = new ShiftScheduler(options);
  return scheduler.schedule();
}
