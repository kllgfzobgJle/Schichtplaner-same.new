import type { Employee, Team, ShiftType, LearningYearQualification, ShiftRule } from './types';

// CSV Utility Functions
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// Employee CSV Functions
export function employeesToCSV(employees: Employee[]): string {
  const headers = [
    'id', 'firstName', 'lastName', 'kuerzel', 'employeeType', 'lehrjahr',
    'grade', 'teamId', 'specificShiftPercentage', 'allowedShifts',
    'availability', 'createdAt', 'updatedAt'
  ];

  let csv = headers.map(escapeCsvValue).join(',') + '\n';

  for (const employee of employees) {
    const row = [
      employee.id,
      employee.firstName,
      employee.lastName,
      employee.kuerzel || '',
      employee.employeeType,
      employee.lehrjahr || '',
      employee.grade,
      employee.teamId,
      employee.specificShiftPercentage || '',
      JSON.stringify(employee.allowedShifts),
      JSON.stringify(employee.availability),
      employee.createdAt.toISOString(),
      employee.updatedAt.toISOString()
    ];
    csv += row.map(escapeCsvValue).join(',') + '\n';
  }

  return csv;
}

export function csvToEmployees(csvContent: string): Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV file must have at least a header and one data row');

  const headers = parseCsvLine(lines[0]);
  const employees: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;

    const employee: any = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];

      switch (header) {
        case 'firstName':
        case 'lastName':
        case 'kuerzel':
        case 'employeeType':
        case 'teamId':
          employee[header] = value;
          break;
        case 'lehrjahr':
        case 'grade':
        case 'specificShiftPercentage':
          employee[header] = value ? Number.parseInt(value) : (header === 'lehrjahr' ? undefined : (header === 'grade' ? 100 : undefined));
          break;
        case 'allowedShifts':
        case 'availability':
          try {
            employee[header] = value ? JSON.parse(value) : (header === 'allowedShifts' ? [] : {});
          } catch {
            employee[header] = header === 'allowedShifts' ? [] : {};
          }
          break;
      }
    }

    if (employee.firstName && employee.lastName && employee.teamId) {
      employees.push(employee);
    }
  }

  return employees;
}

// Team CSV Functions
export function teamsToCSV(teams: Team[]): string {
  const headers = ['id', 'name', 'overallShiftPercentage', 'createdAt', 'updatedAt'];

  let csv = headers.map(escapeCsvValue).join(',') + '\n';

  for (const team of teams) {
    const row = [
      team.id,
      team.name,
      team.overallShiftPercentage,
      team.createdAt.toISOString(),
      team.updatedAt.toISOString()
    ];
    csv += row.map(escapeCsvValue).join(',') + '\n';
  }

  return csv;
}

export function csvToTeams(csvContent: string): Omit<Team, 'id' | 'createdAt' | 'updatedAt'>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV file must have at least a header and one data row');

  const headers = parseCsvLine(lines[0]);
  const teams: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;

    const team: any = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];

      switch (header) {
        case 'name':
          team[header] = value;
          break;
        case 'overallShiftPercentage':
          team[header] = value ? Number.parseInt(value) : 60;
          break;
      }
    }

    if (team.name) {
      teams.push(team);
    }
  }

  return teams;
}

// Shift Type CSV Functions
export function shiftTypesToCSV(shiftTypes: ShiftType[]): string {
  const headers = ['id', 'name', 'startTime', 'endTime', 'weeklyNeeds', 'createdAt', 'updatedAt'];

  let csv = headers.map(escapeCsvValue).join(',') + '\n';

  for (const shiftType of shiftTypes) {
    const row = [
      shiftType.id,
      shiftType.name,
      shiftType.startTime,
      shiftType.endTime,
      JSON.stringify(shiftType.weeklyNeeds),
      shiftType.createdAt.toISOString(),
      shiftType.updatedAt.toISOString()
    ];
    csv += row.map(escapeCsvValue).join(',') + '\n';
  }

  return csv;
}

export function csvToShiftTypes(csvContent: string): Omit<ShiftType, 'id' | 'createdAt' | 'updatedAt'>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV file must have at least a header and one data row');

  const headers = parseCsvLine(lines[0]);
  const shiftTypes: Omit<ShiftType, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;

    const shiftType: any = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];

      switch (header) {
        case 'name':
        case 'startTime':
        case 'endTime':
          shiftType[header] = value;
          break;
        case 'weeklyNeeds':
          try {
            shiftType[header] = value ? JSON.parse(value) : {};
          } catch {
            shiftType[header] = {};
          }
          break;
      }
    }

    if (shiftType.name && shiftType.startTime && shiftType.endTime) {
      shiftTypes.push(shiftType);
    }
  }

  return shiftTypes;
}

// Learning Year Qualifications CSV Functions
export function learningYearQualificationsToCSV(qualifications: LearningYearQualification[]): string {
  const headers = ['id', 'jahr', 'qualifiedShiftTypes', 'defaultAvailability', 'updatedAt'];

  let csv = headers.map(escapeCsvValue).join(',') + '\n';

  for (const qualification of qualifications) {
    const row = [
      qualification.id,
      qualification.jahr,
      JSON.stringify(qualification.qualifiedShiftTypes),
      JSON.stringify(qualification.defaultAvailability),
      qualification.updatedAt.toISOString()
    ];
    csv += row.map(escapeCsvValue).join(',') + '\n';
  }

  return csv;
}

export function csvToLearningYearQualifications(csvContent: string): Partial<LearningYearQualification>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV file must have at least a header and one data row');

  const headers = parseCsvLine(lines[0]);
  const qualifications: Partial<LearningYearQualification>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;

    const qualification: any = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];

      switch (header) {
        case 'jahr':
          qualification[header] = value ? Number.parseInt(value) : 1;
          break;
        case 'qualifiedShiftTypes':
        case 'defaultAvailability':
          try {
            qualification[header] = value ? JSON.parse(value) : (header === 'qualifiedShiftTypes' ? [] : {});
          } catch {
            qualification[header] = header === 'qualifiedShiftTypes' ? [] : {};
          }
          break;
      }
    }

    if (qualification.jahr) {
      qualifications.push(qualification);
    }
  }

  return qualifications;
}

// Shift Rules CSV Functions
export function shiftRulesToCSV(rules: ShiftRule[]): string {
  const headers = ['id', 'type', 'name', 'fromShiftId', 'toShiftId', 'toShiftIds', 'sameDay', 'createdAt', 'updatedAt'];

  let csv = headers.map(escapeCsvValue).join(',') + '\n';

  for (const rule of rules) {
    const row = [
      rule.id,
      rule.type,
      rule.name,
      rule.fromShiftId,
      rule.toShiftId || '',
      JSON.stringify(rule.toShiftIds || []),
      rule.sameDay ? 'true' : 'false',
      rule.createdAt.toISOString(),
      rule.updatedAt.toISOString()
    ];
    csv += row.map(escapeCsvValue).join(',') + '\n';
  }

  return csv;
}

export function csvToShiftRules(csvContent: string): Omit<ShiftRule, 'id' | 'createdAt' | 'updatedAt'>[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('CSV file must have at least a header and one data row');

  const headers = parseCsvLine(lines[0]);
  const rules: Omit<ShiftRule, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;

    const rule: any = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j];

      switch (header) {
        case 'type':
        case 'name':
        case 'fromShiftId':
        case 'toShiftId':
          rule[header] = value;
          break;
        case 'toShiftIds':
          try {
            rule[header] = value ? JSON.parse(value) : [];
          } catch {
            rule[header] = [];
          }
          break;
        case 'sameDay':
          rule[header] = value === 'true';
          break;
      }
    }

    if (rule.type && rule.fromShiftId) {
      rules.push(rule);
    }
  }

  return rules;
}

// Generic download function
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
