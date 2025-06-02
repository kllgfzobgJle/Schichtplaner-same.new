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

    for (const rule of this.options.shiftRules) {
      if (rule.type === 'forbidden_sequence' && rule.fromShiftId && (rule.toShiftId || rule.toShiftIds?.length)) {
        // Check same day conflicts
        if (rule.sameDay) {
          const existingAssignment = this.assignments.find(a =>
            a.employeeId === employee.id &&
            a.date === dateStr &&
            a.shiftId === rule.fromShiftId
          );

          if (existingAssignment &&
              ((rule.toShiftIds?.includes(shiftType.id)) ||
               rule.toShiftId === shiftType.id)) {
            return `Forbidden same-day sequence: ${rule.name}`;
          }
        }

        // Check next day conflicts (when sameDay is false)
        if (!rule.sameDay) {
          const previousDate = new Date(date);
          previousDate.setDate(date.getDate() - 1);
          const previousDateStr = previousDate.toISOString().split('T')[0];

          const previousAssignment = this.assignments.find(a =>
            a.employeeId === employee.id &&
            a.date === previousDateStr &&
            a.shiftId === rule.fromShiftId
          );

          if (previousAssignment &&
              ((rule.toShiftIds?.includes(shiftType.id)) ||
               rule.toShiftId === shiftType.id)) {
            return `Forbidden next-day sequence: ${rule.name}`;
          }
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

  private enforceMandatoryFollowUps(): void {
    const mandatoryRules = this.options.shiftRules.filter(r => r.type === 'mandatory_follow_up');

    for (const rule of mandatoryRules) {
      if (!rule.toShiftId) continue;

      // Find all assignments with the "from" shift
      const fromAssignments = this.assignments.filter(a =>
        a.shiftId === rule.fromShiftId && !a.isFollowUp
      );

      for (const fromAssignment of fromAssignments) {
        const employee = this.options.employees.find(e => e.id === fromAssignment.employeeId);
        const toShiftType = this.options.shiftTypes.find(st => st.id === rule.toShiftId);
        const date = new Date(fromAssignment.date);

        if (!employee || !toShiftType) continue;

        // Check if employee already has the mandatory follow-up
        const existingFollowUp = this.assignments.find(a =>
          a.employeeId === employee.id &&
          a.date === fromAssignment.date &&
          a.shiftId === rule.toShiftId
        );

        if (existingFollowUp) continue;

        // Check if the mandatory follow-up slot is available
        const slotOccupied = this.assignments.some(a =>
          a.date === fromAssignment.date &&
          a.shiftId === rule.toShiftId &&
          !a.isFollowUp
        );

        if (slotOccupied) {
          this.conflicts.push(`Mandatory follow-up conflict: ${employee.firstName} ${employee.lastName} needs ${toShiftType.name} on ${fromAssignment.date} but slot is occupied`);
          continue;
        }

        // Check if employee is qualified and available
        if (!this.isEmployeeQualified(employee, toShiftType)) {
          this.conflicts.push(`Mandatory follow-up conflict: ${employee.firstName} ${employee.lastName} not qualified for ${toShiftType.name} on ${fromAssignment.date}`);
          continue;
        }

        if (!this.isEmployeeAvailable(employee, date, toShiftType)) {
          this.conflicts.push(`Mandatory follow-up conflict: ${employee.firstName} ${employee.lastName} not available for ${toShiftType.name} on ${fromAssignment.date}`);
          continue;
        }

        // Assign the mandatory follow-up
        this.assignShift(employee, date, toShiftType, true);
      }
    }
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

    // Check if slot is already occupied (but allow follow-ups to be added to occupied slots)
    const existingAssignment = this.assignments.find(a =>
      a.date === dateStr &&
      a.shiftId === shiftType.id
    );

    if (existingAssignment && !isFollowUp) return false;

    // For follow-ups, allow multiple assignments per employee per day
    // For regular assignments, check if employee already has a main assignment this day
    if (!isFollowUp) {
      const employeeExistingAssignment = this.assignments.find(a =>
        a.employeeId === employee.id &&
        a.date === dateStr &&
        !a.isFollowUp
      );

      if (employeeExistingAssignment) return false;
    }

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

    // After all regular assignments, enforce mandatory follow-ups
    this.enforceMandatoryFollowUps();

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

    // Sort shifts by priority (early shifts first, then priority)
    requiredShifts.sort((a, b) => {
      const aStart = Number.parseInt(a.shiftType.startTime.split(':')[0]);
      const bStart = Number.parseInt(b.shiftType.startTime.split(':')[0]);
      return aStart - bStart;
    });

    // Assign shifts with multiple strategies
    for (const { shiftType, count } of requiredShifts) {
      const currentAssignments = this.assignments.filter(a =>
        a.date === dateStr &&
        a.shiftId === shiftType.id &&
        !a.isFollowUp
      ).length;

      const needed = count - currentAssignments;

      for (let i = 0; i < needed; i++) {
        let assigned = false;

        // Strategy 1: Try with all rules enforced
        assigned = this.tryAssignShiftWithStrategy(date, shiftType, true);

        // Strategy 2: If failed, try with relaxed rule checking
        if (!assigned) {
          assigned = this.tryAssignShiftWithStrategy(date, shiftType, false);
        }

        // Strategy 3: Emergency assignment (only basic checks)
        if (!assigned) {
          assigned = this.tryEmergencyAssignment(date, shiftType);
        }

        if (!assigned) {
          this.conflicts.push(`Unassigned shift: ${shiftType.name} on ${dateStr} (Position ${i + 1})`);
        }
      }
    }
  }

  private tryAssignShiftWithStrategy(date: Date, shiftType: ShiftType, enforceRules: boolean): boolean {
    const dateStr = date.toISOString().split('T')[0];
    const sortedEmployees = this.sortEmployeesByWorkload();

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

      // Check shift rules (only if enforcing)
      if (enforceRules) {
        const ruleConflict = this.hasShiftRuleConflict(employee, date, shiftType);
        if (ruleConflict) {
          continue; // Don't add to conflicts yet, try other employees first
        }
      }

      // Assign the shift
      if (this.assignShift(employee, date, shiftType)) {
        return true;
      }
    }

    return false;
  }

  private tryEmergencyAssignment(date: Date, shiftType: ShiftType): boolean {
    const dateStr = date.toISOString().split('T')[0];
    const sortedEmployees = this.sortEmployeesByWorkload();

    for (const employee of sortedEmployees) {
      // Skip if employee already has assignment this day (non-follow-up)
      const hasAssignment = this.assignments.some(a =>
        a.employeeId === employee.id &&
        a.date === dateStr &&
        !a.isFollowUp
      );

      if (hasAssignment) continue;

      // Only check basic qualifications, ignore availability and rules
      if (!this.isEmployeeQualified(employee, shiftType)) continue;

      // Assign the shift with conflict note
      if (this.assignShift(employee, date, shiftType)) {
        this.conflicts.push(`Emergency assignment: ${employee.firstName} ${employee.lastName} assigned to ${shiftType.name} on ${dateStr} (may violate availability or rules)`);
        return true;
      }
    }

    return false;
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
