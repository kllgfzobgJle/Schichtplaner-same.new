import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, isWeekend, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Employee, Team, ShiftType, ShiftAssignment, WorkloadStats } from './types';

export interface ReportOptions {
  startDate: Date;
  endDate: Date;
  employees: Employee[];
  teams: Team[];
  shiftTypes: ShiftType[];
  assignments: ShiftAssignment[];
  workloadStats: Record<string, WorkloadStats>;
  conflicts: string[];
  title?: string;
  includeStatistics?: boolean;
  includeConflicts?: boolean;
  includeEmployeeDetails?: boolean;
  includeTeamSummary?: boolean;
}

export class ReportGenerator {
  private doc: jsPDF;
  private options: ReportOptions;
  private yPosition = 20;
  private pageHeight = 297; // A4 height in mm
  private margin = 20;

  constructor(options: ReportOptions) {
    this.options = options;
    this.doc = new jsPDF();
    this.doc.setFontSize(12);
  }

  private addTitle(title: string): void {
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.yPosition);
    this.yPosition += 15;

    // Add period info
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    const periodText = `Zeitraum: ${format(this.options.startDate, 'dd.MM.yyyy', { locale: de })} - ${format(this.options.endDate, 'dd.MM.yyyy', { locale: de })}`;
    this.doc.text(periodText, this.margin, this.yPosition);
    this.yPosition += 10;

    // Add generation date
    const generatedText = `Erstellt am: ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de })}`;
    this.doc.text(generatedText, this.margin, this.yPosition);
    this.yPosition += 15;
  }

  private checkPageBreak(neededSpace = 20): void {
    if (this.yPosition + neededSpace > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.yPosition = this.margin;
    }
  }

  private addSection(title: string): void {
    this.checkPageBreak(30);
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin, this.yPosition);
    this.yPosition += 10;
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
  }

  private generateOverviewStatistics(): void {
    this.addSection('Übersicht');

    const totalAssignments = this.options.assignments.filter(a => !a.isFollowUp).length;
    const totalHours = Object.values(this.options.workloadStats).reduce((sum, stats) => sum + stats.hours, 0);
    const activeEmployees = Object.keys(this.options.workloadStats).filter(id => this.options.workloadStats[id].shifts > 0).length;

    const stats = [
      ['Gesamtanzahl Zuweisungen', totalAssignments.toString()],
      ['Gesamtarbeitsstunden', `${totalHours.toFixed(1)} h`],
      ['Aktive Mitarbeiter', `${activeEmployees} von ${this.options.employees.length}`],
      ['Teams', this.options.teams.length.toString()],
      ['Schichttypen', this.options.shiftTypes.length.toString()],
      ['Konflikte', this.options.conflicts.length.toString()],
    ];

    autoTable(this.doc, {
      startY: this.yPosition,
      head: [['Metrik', 'Wert']],
      body: stats,
      theme: 'grid',
      headStyles: { fillColor: [65, 105, 200] as any },
      margin: { left: this.margin, right: this.margin },
    });

    this.yPosition = (this.doc as any).lastAutoTable.finalY + 15;
  }

  private generateEmployeeWorkloadReport(): void {
    this.addSection('Mitarbeiter-Auslastung');

    const employeeData = this.options.employees.map(employee => {
      const stats = this.options.workloadStats[employee.id] || {
        hours: 0,
        shifts: 0,
        targetPercentage: 100,
        daysWorkedThisPeriod: {},
      };

      const team = this.options.teams.find(t => t.id === employee.teamId);
      const expectedHours = (stats.targetPercentage / 100) * 40 * 4; // 4 weeks
      const utilizationPercentage = expectedHours > 0 ? (stats.hours / expectedHours) * 100 : 0;
      const daysWorked = Object.keys(stats.daysWorkedThisPeriod).length;

      return [
        `${employee.firstName} ${employee.lastName}`,
        team?.name || 'Unbekannt',
        stats.shifts.toString(),
        `${stats.hours.toFixed(1)} h`,
        `${daysWorked}`,
        `${utilizationPercentage.toFixed(0)}%`,
        utilizationPercentage > 110 ? 'Überlastet' : utilizationPercentage < 80 ? 'Unterausgelastet' : 'Normal'
      ];
    }).sort((a, b) => Number.parseFloat(b[5]) - Number.parseFloat(a[5])); // Sort by utilization

    autoTable(this.doc, {
      startY: this.yPosition,
      head: [['Name', 'Team', 'Schichten', 'Stunden', 'Tage', 'Auslastung', 'Status']],
      body: employeeData,
      theme: 'striped',
      headStyles: { fillColor: [65, 105, 200] as any },
      margin: { left: this.margin, right: this.margin },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'center' },
        5: { halign: 'right' },
        6: { halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.column.index === 6 && data.cell.text[0]) {
          const status = data.cell.text[0];
          if (status === 'Überlastet') {
            data.cell.styles.textColor = [220, 38, 38]; // Red
          } else if (status === 'Unterausgelastet') {
            data.cell.styles.textColor = [245, 158, 11]; // Orange
          } else {
            data.cell.styles.textColor = [34, 197, 94]; // Green
          }
        }
      }
    });

    this.yPosition = (this.doc as any).lastAutoTable.finalY + 15;
  }

  private generateTeamSummary(): void {
    this.addSection('Team-Zusammenfassung');

    const teamData = this.options.teams.map(team => {
      const teamEmployees = this.options.employees.filter(emp => emp.teamId === team.id);
      const teamAssignments = this.options.assignments.filter(a =>
        teamEmployees.some(emp => emp.id === a.employeeId) && !a.isFollowUp
      );

      const totalHours = teamEmployees.reduce((total, emp) => {
        return total + (this.options.workloadStats[emp.id]?.hours || 0);
      }, 0);

      const averageHours = teamEmployees.length > 0 ? totalHours / teamEmployees.length : 0;

      return [
        team.name,
        teamEmployees.length.toString(),
        teamAssignments.length.toString(),
        `${totalHours.toFixed(1)} h`,
        `${averageHours.toFixed(1)} h`,
        `${team.overallShiftPercentage}%`
      ];
    });

    autoTable(this.doc, {
      startY: this.yPosition,
      head: [['Team', 'Mitarbeiter', 'Zuweisungen', 'Gesamt h', 'Ø Stunden', 'Zielanteil']],
      body: teamData,
      theme: 'striped',
      headStyles: { fillColor: [65, 105, 200] as any },
      margin: { left: this.margin, right: this.margin },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      }
    });

    this.yPosition = (this.doc as any).lastAutoTable.finalY + 15;
  }

  private generateShiftScheduleTable(): void {
    this.addSection('Schichtplan-Übersicht');

    // Group assignments by date and shift type
    const scheduleData: Record<string, Record<string, string[]>> = {};

    // Initialize date range
    const days = eachDayOfInterval({ start: this.options.startDate, end: this.options.endDate })
      .filter(day => !isWeekend(day)); // Only weekdays

    for (const day of days) {
      const dateStr = day.toISOString().split('T')[0];
      scheduleData[dateStr] = {};

      for (const shiftType of this.options.shiftTypes) {
        scheduleData[dateStr][shiftType.id] = [];
      }
    }

    // Fill in assignments
    for (const assignment of this.options.assignments.filter(a => !a.isFollowUp)) {
      const employee = this.options.employees.find(e => e.id === assignment.employeeId);
      if (employee && scheduleData[assignment.date]) {
        const displayName = employee.kuerzel || `${employee.firstName.substring(0, 2)}.${employee.lastName.substring(0, 2)}.`;
        if (!scheduleData[assignment.date][assignment.shiftId]) {
          scheduleData[assignment.date][assignment.shiftId] = [];
        }
        scheduleData[assignment.date][assignment.shiftId].push(displayName);
      }
    }

    // Create table data
    const tableData = [];

    // Group by weeks
    const weeks = [];
    let currentWeekStart = startOfWeek(this.options.startDate, { weekStartsOn: 1 });

    while (currentWeekStart <= this.options.endDate) {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const weekDays = eachDayOfInterval({
        start: currentWeekStart,
        end: weekEnd > this.options.endDate ? this.options.endDate : weekEnd
      }).filter(day => !isWeekend(day) && day >= this.options.startDate);

      weeks.push(weekDays);
      currentWeekStart = new Date(currentWeekStart);
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
      const week = weeks[weekIndex];

      // Add week header
      tableData.push([
        { content: `Woche ${weekIndex + 1}`, colSpan: 6, styles: { halign: 'center' as any, fillColor: [200, 200, 200] as any, fontStyle: 'bold' as any } }
      ]);

      // Add day headers
      const dayHeaders = ['Schicht', ...week.map(day => format(day, 'E dd.MM', { locale: de }))];
      tableData.push(dayHeaders);

      // Add shift rows
      for (const shiftType of this.options.shiftTypes) {
        const shiftRow = [
          `${shiftType.name}\n(${shiftType.startTime}-${shiftType.endTime})`,
          ...week.map(day => {
            const dateStr = day.toISOString().split('T')[0];
            const assignments = scheduleData[dateStr]?.[shiftType.id] || [];
            return assignments.length > 0 ? assignments.join(', ') : '-';
          })
        ];
        tableData.push(shiftRow);
      }

      // Add spacing between weeks
      if (weekIndex < weeks.length - 1) {
        tableData.push([{ content: '', colSpan: 6, styles: { minCellHeight: 5 } }]);
      }
    }

    autoTable(this.doc, {
      startY: this.yPosition,
      body: tableData,
      theme: 'grid',
      margin: { left: this.margin, right: this.margin },
      columnStyles: {
        0: { cellWidth: 25, fontSize: 8 },
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      didParseCell: (data) => {
        if (data.cell.text[0] && data.cell.text[0].includes('Woche')) {
          data.cell.styles.fontStyle = 'bold' as any;
          data.cell.styles.fillColor = [230, 230, 230] as any;
        }
      }
    });

    this.yPosition = (this.doc as any).lastAutoTable.finalY + 15;
  }

  private generateConflictReport(): void {
    if (this.options.conflicts.length === 0) return;

    this.addSection('Konflikte und Probleme');

    const conflictData = this.options.conflicts.map((conflict, index) => [
      (index + 1).toString(),
      conflict
    ]);

    autoTable(this.doc, {
      startY: this.yPosition,
      head: [['#', 'Beschreibung']],
      body: conflictData,
      theme: 'striped',
      headStyles: { fillColor: [220, 38, 38] as any },
      margin: { left: this.margin, right: this.margin },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 160 },
      }
    });

    this.yPosition = (this.doc as any).lastAutoTable.finalY + 15;
  }

  public generateReport(): Uint8Array {
    const title = this.options.title || 'Schichtplan-Bericht';

    this.addTitle(title);

    if (this.options.includeStatistics !== false) {
      this.generateOverviewStatistics();
    }

    if (this.options.includeEmployeeDetails !== false) {
      this.generateEmployeeWorkloadReport();
    }

    if (this.options.includeTeamSummary !== false) {
      this.generateTeamSummary();
    }

    this.generateShiftScheduleTable();

    if (this.options.includeConflicts !== false) {
      this.generateConflictReport();
    }

    return new Uint8Array(this.doc.output('arraybuffer') as ArrayBuffer);
  }

  public downloadReport(filename?: string): void {
    const reportData = this.generateReport();
    const blob = new Blob([reportData], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `schichtplan_bericht_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }
}

// Convenience function for quick report generation
export function generateShiftPlanReport(options: ReportOptions): void {
  const generator = new ReportGenerator(options);
  generator.downloadReport();
}

// Generate employee time tracking report
export function generateTimeTrackingReport(options: ReportOptions): void {
  const generator = new ReportGenerator({
    ...options,
    title: 'Zeiterfassung - Mitarbeiter Report',
    includeStatistics: true,
    includeEmployeeDetails: true,
    includeTeamSummary: true,
    includeConflicts: false,
  });
  generator.downloadReport(`zeiterfassung_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

// Generate team summary report
export function generateTeamSummaryReport(options: ReportOptions): void {
  const generator = new ReportGenerator({
    ...options,
    title: 'Team-Übersicht Report',
    includeStatistics: true,
    includeEmployeeDetails: false,
    includeTeamSummary: true,
    includeConflicts: false,
  });
  generator.downloadReport(`team_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
