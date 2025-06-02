import type {
  Employee,
  Team,
  ShiftType,
  LearningYearQualification,
  ShiftRule,
  ShiftPlan
} from './types';

// Local storage keys
const STORAGE_KEYS = {
  employees: 'schichtplaner-employees',
  teams: 'schichtplaner-teams',
  shiftTypes: 'schichtplaner-shift-types',
  learningYearQualifications: 'schichtplaner-learning-year-qualifications',
  shiftRules: 'schichtplaner-shift-rules',
  shiftPlans: 'schichtplaner-shift-plans',
};

// Generic storage functions
function getFromStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function saveToStorage<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Employee management
export function getEmployees(): Employee[] {
  return getFromStorage<Employee>(STORAGE_KEYS.employees);
}

export function saveEmployee(employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Employee {
  const employees = getEmployees();
  const newEmployee: Employee = {
    ...employee,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  employees.push(newEmployee);
  saveToStorage(STORAGE_KEYS.employees, employees);
  return newEmployee;
}

export function updateEmployee(id: string, updates: Partial<Employee>): Employee | null {
  const employees = getEmployees();
  const index = employees.findIndex(emp => emp.id === id);
  if (index === -1) return null;

  employees[index] = {
    ...employees[index],
    ...updates,
    updatedAt: new Date(),
  };
  saveToStorage(STORAGE_KEYS.employees, employees);
  return employees[index];
}

export function deleteEmployee(id: string): boolean {
  const employees = getEmployees();
  const filteredEmployees = employees.filter(emp => emp.id !== id);
  if (filteredEmployees.length === employees.length) return false;

  saveToStorage(STORAGE_KEYS.employees, filteredEmployees);
  return true;
}

// Team management
export function getTeams(): Team[] {
  return getFromStorage<Team>(STORAGE_KEYS.teams);
}

export function saveTeam(team: Omit<Team, 'id' | 'createdAt' | 'updatedAt'>): Team {
  const teams = getTeams();
  const newTeam: Team = {
    ...team,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  teams.push(newTeam);
  saveToStorage(STORAGE_KEYS.teams, teams);
  return newTeam;
}

export function updateTeam(id: string, updates: Partial<Team>): Team | null {
  const teams = getTeams();
  const index = teams.findIndex(team => team.id === id);
  if (index === -1) return null;

  teams[index] = {
    ...teams[index],
    ...updates,
    updatedAt: new Date(),
  };
  saveToStorage(STORAGE_KEYS.teams, teams);
  return teams[index];
}

export function deleteTeam(id: string): boolean {
  const teams = getTeams();
  const filteredTeams = teams.filter(team => team.id !== id);
  if (filteredTeams.length === teams.length) return false;

  saveToStorage(STORAGE_KEYS.teams, filteredTeams);
  return true;
}

// Shift type management
export function getShiftTypes(): ShiftType[] {
  return getFromStorage<ShiftType>(STORAGE_KEYS.shiftTypes);
}

export function saveShiftType(shiftType: Omit<ShiftType, 'id' | 'createdAt' | 'updatedAt'>): ShiftType {
  const shiftTypes = getShiftTypes();
  const newShiftType: ShiftType = {
    ...shiftType,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  shiftTypes.push(newShiftType);
  saveToStorage(STORAGE_KEYS.shiftTypes, shiftTypes);
  return newShiftType;
}

export function updateShiftType(id: string, updates: Partial<ShiftType>): ShiftType | null {
  const shiftTypes = getShiftTypes();
  const index = shiftTypes.findIndex(st => st.id === id);
  if (index === -1) return null;

  shiftTypes[index] = {
    ...shiftTypes[index],
    ...updates,
    updatedAt: new Date(),
  };
  saveToStorage(STORAGE_KEYS.shiftTypes, shiftTypes);
  return shiftTypes[index];
}

export function deleteShiftType(id: string): boolean {
  const shiftTypes = getShiftTypes();
  const filteredShiftTypes = shiftTypes.filter(st => st.id !== id);
  if (filteredShiftTypes.length === shiftTypes.length) return false;

  saveToStorage(STORAGE_KEYS.shiftTypes, filteredShiftTypes);
  return true;
}

// Learning year qualification management
export function getLearningYearQualifications(): LearningYearQualification[] {
  const stored = getFromStorage<LearningYearQualification>(STORAGE_KEYS.learningYearQualifications);

  // Ensure we have entries for all 4 learning years
  const years = [1, 2, 3, 4];
  const result: LearningYearQualification[] = [];

  for (const year of years) {
    const existing = stored.find(q => q.jahr === year);
    if (existing) {
      result.push(existing);
    } else {
      result.push({
        id: year.toString(),
        jahr: year,
        qualifiedShiftTypes: [],
        defaultAvailability: {},
        updatedAt: new Date(),
      });
    }
  }

  return result;
}

export function updateLearningYearQualification(
  jahr: number,
  updates: Partial<LearningYearQualification>
): LearningYearQualification {
  const qualifications = getLearningYearQualifications();
  const index = qualifications.findIndex(q => q.jahr === jahr);

  if (index === -1) {
    // Create new if doesn't exist
    const newQualification: LearningYearQualification = {
      id: jahr.toString(),
      jahr,
      qualifiedShiftTypes: [],
      defaultAvailability: {},
      ...updates,
      updatedAt: new Date(),
    };
    qualifications.push(newQualification);
  } else {
    qualifications[index] = {
      ...qualifications[index],
      ...updates,
      updatedAt: new Date(),
    };
  }

  saveToStorage(STORAGE_KEYS.learningYearQualifications, qualifications);
  const result = qualifications.find(q => q.jahr === jahr);
  if (!result) {
    throw new Error(`Learning year qualification for year ${jahr} not found`);
  }
  return result;
}

// Shift rule management
export function getShiftRules(): ShiftRule[] {
  return getFromStorage<ShiftRule>(STORAGE_KEYS.shiftRules);
}

export function saveShiftRule(shiftRule: Omit<ShiftRule, 'id' | 'createdAt' | 'updatedAt'>): ShiftRule {
  const shiftRules = getShiftRules();
  const newShiftRule: ShiftRule = {
    ...shiftRule,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  shiftRules.push(newShiftRule);
  saveToStorage(STORAGE_KEYS.shiftRules, shiftRules);
  return newShiftRule;
}

export function updateShiftRule(id: string, updates: Partial<ShiftRule>): ShiftRule | null {
  const shiftRules = getShiftRules();
  const index = shiftRules.findIndex(rule => rule.id === id);
  if (index === -1) return null;

  shiftRules[index] = {
    ...shiftRules[index],
    ...updates,
    updatedAt: new Date(),
  };
  saveToStorage(STORAGE_KEYS.shiftRules, shiftRules);
  return shiftRules[index];
}

export function deleteShiftRule(id: string): boolean {
  const shiftRules = getShiftRules();
  const filteredShiftRules = shiftRules.filter(rule => rule.id !== id);
  if (filteredShiftRules.length === shiftRules.length) return false;

  saveToStorage(STORAGE_KEYS.shiftRules, filteredShiftRules);
  return true;
}

// Shift plan management
export function getShiftPlans(): ShiftPlan[] {
  return getFromStorage<ShiftPlan>(STORAGE_KEYS.shiftPlans);
}

export function saveShiftPlan(shiftPlan: Omit<ShiftPlan, 'id' | 'createdAt' | 'updatedAt'>): ShiftPlan {
  const shiftPlans = getShiftPlans();
  const newShiftPlan: ShiftPlan = {
    ...shiftPlan,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  shiftPlans.push(newShiftPlan);
  saveToStorage(STORAGE_KEYS.shiftPlans, shiftPlans);
  return newShiftPlan;
}

export function updateShiftPlan(id: string, updates: Partial<ShiftPlan>): ShiftPlan | null {
  const shiftPlans = getShiftPlans();
  const index = shiftPlans.findIndex(plan => plan.id === id);
  if (index === -1) return null;

  shiftPlans[index] = {
    ...shiftPlans[index],
    ...updates,
    updatedAt: new Date(),
  };
  saveToStorage(STORAGE_KEYS.shiftPlans, shiftPlans);
  return shiftPlans[index];
}

export function deleteShiftPlan(id: string): boolean {
  const shiftPlans = getShiftPlans();
  const filteredShiftPlans = shiftPlans.filter(plan => plan.id !== id);
  if (filteredShiftPlans.length === shiftPlans.length) return false;

  saveToStorage(STORAGE_KEYS.shiftPlans, filteredShiftPlans);
  return true;
}

// Export/Import all data
export function exportAllData(): void {
  const allData = {
    employees: getEmployees(),
    teams: getTeams(),
    shiftTypes: getShiftTypes(),
    learningYearQualifications: getLearningYearQualifications(),
    shiftRules: getShiftRules(),
    shiftPlans: getShiftPlans(),
    exportDate: new Date().toISOString(),
  };

  const dataStr = JSON.stringify(allData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `schichtplaner_export_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function importAllData(jsonString: string): void {
  const data = JSON.parse(jsonString);

  if (data.employees) saveToStorage(STORAGE_KEYS.employees, data.employees);
  if (data.teams) saveToStorage(STORAGE_KEYS.teams, data.teams);
  if (data.shiftTypes) saveToStorage(STORAGE_KEYS.shiftTypes, data.shiftTypes);
  if (data.learningYearQualifications) saveToStorage(STORAGE_KEYS.learningYearQualifications, data.learningYearQualifications);
  if (data.shiftRules) saveToStorage(STORAGE_KEYS.shiftRules, data.shiftRules);
  if (data.shiftPlans) saveToStorage(STORAGE_KEYS.shiftPlans, data.shiftPlans);
}
