'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Clock, AlertTriangle, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import type { Employee, Team, ShiftType, ShiftAssignment, WorkloadStats } from '@/lib/types';

interface AnalyticsDashboardProps {
  employees: Employee[];
  teams: Team[];
  shiftTypes: ShiftType[];
  assignments: ShiftAssignment[];
  workloadStats: Record<string, WorkloadStats>;
  conflicts: string[];
  startDate: Date;
  endDate: Date;
}

export function AnalyticsDashboard({
  employees,
  teams,
  shiftTypes,
  assignments,
  workloadStats,
  conflicts,
  startDate,
  endDate,
}: AnalyticsDashboardProps) {

  // Calculate period length in weeks
  const getPeriodLength = () => {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24 * 7));
  };

  // Calculate total working hours in the period
  const calculateTotalHours = () => {
    return Object.values(workloadStats).reduce((total, stats) => total + stats.hours, 0);
  };

  // Calculate shift coverage statistics
  const calculateCoverageStats = () => {
    const totalRequired = shiftTypes.reduce((total, shiftType) => {
      const weeklyNeed = Object.values(shiftType.weeklyNeeds).reduce((sum, need) => sum + need, 0);
      return total + (weeklyNeed * getPeriodLength());
    }, 0);

    const totalAssigned = assignments.filter(a => !a.isFollowUp).length;
    const coveragePercentage = totalRequired > 0 ? (totalAssigned / totalRequired) * 100 : 0;

    return {
      totalRequired,
      totalAssigned,
      coveragePercentage,
      unassigned: totalRequired - totalAssigned,
    };
  };

  // Get team statistics
  const getTeamStats = () => {
    return teams.map(team => {
      const teamEmployees = employees.filter(emp => emp.teamId === team.id);
      const teamAssignments = assignments.filter(a =>
        teamEmployees.some(emp => emp.id === a.employeeId) && !a.isFollowUp
      );

      const totalHours = teamEmployees.reduce((total, emp) => {
        return total + (workloadStats[emp.id]?.hours || 0);
      }, 0);

      const averageHours = teamEmployees.length > 0 ? totalHours / teamEmployees.length : 0;

      return {
        team,
        employeeCount: teamEmployees.length,
        totalAssignments: teamAssignments.length,
        totalHours,
        averageHours,
      };
    });
  };

  // Get employee workload analysis
  const getEmployeeAnalysis = () => {
    return employees.map(employee => {
      const stats = workloadStats[employee.id] || {
        hours: 0,
        shifts: 0,
        targetPercentage: 100,
        daysWorkedThisPeriod: {},
      };

      const team = teams.find(t => t.id === employee.teamId);
      const expectedHours = (stats.targetPercentage / 100) * 40 * getPeriodLength(); // Assuming 40h full-time week
      const utilizationPercentage = expectedHours > 0 ? (stats.hours / expectedHours) * 100 : 0;

      const isOverworked = utilizationPercentage > 110;
      const isUnderworked = utilizationPercentage < 80;
      const daysWorked = Object.keys(stats.daysWorkedThisPeriod).length;

      return {
        employee,
        team,
        stats,
        expectedHours,
        utilizationPercentage,
        isOverworked,
        isUnderworked,
        daysWorked,
      };
    }).sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);
  };

  // Get shift type utilization
  const getShiftTypeUtilization = () => {
    return shiftTypes.map(shiftType => {
      const totalRequired = Object.values(shiftType.weeklyNeeds).reduce((sum, need) => sum + need, 0) * getPeriodLength();
      const totalAssigned = assignments.filter(a => a.shiftId === shiftType.id && !a.isFollowUp).length;
      const utilizationPercentage = totalRequired > 0 ? (totalAssigned / totalRequired) * 100 : 0;

      return {
        shiftType,
        totalRequired,
        totalAssigned,
        utilizationPercentage,
        isUnderStaffed: utilizationPercentage < 100,
      };
    }).sort((a, b) => a.utilizationPercentage - b.utilizationPercentage);
  };

  const coverageStats = calculateCoverageStats();
  const teamStats = getTeamStats();
  const employeeAnalysis = getEmployeeAnalysis();
  const shiftTypeUtilization = getShiftTypeUtilization();
  const periodWeeks = getPeriodLength();

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtabdeckung</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coverageStats.coveragePercentage.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {coverageStats.totalAssigned} von {coverageStats.totalRequired} Schichten besetzt
            </p>
            <Progress value={coverageStats.coveragePercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gesamtstunden</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calculateTotalHours()}</div>
            <p className="text-xs text-muted-foreground">
              Über {periodWeeks} Wochen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive Mitarbeiter</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(workloadStats).filter(id => workloadStats[id].shifts > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Von {employees.length} Gesamt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Konflikte</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{conflicts.length}</div>
            <p className="text-xs text-muted-foreground">
              Planungskonflikte
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Workload Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Mitarbeiter-Auslastung</CardTitle>
            <CardDescription>
              Analyse der Arbeitszeit-Verteilung pro Mitarbeiter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {employeeAnalysis.map(({ employee, stats, utilizationPercentage, isOverworked, isUnderworked, daysWorked }) => (
                <div key={employee.id} className="flex items-center justify-between p-2 rounded border">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stats.hours}h • {stats.shifts} Schichten • {daysWorked} Tage
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {utilizationPercentage.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {stats.targetPercentage}% Stelle
                      </div>
                    </div>
                    {isOverworked && (
                      <Badge variant="destructive" className="text-xs">
                        Überlastet
                      </Badge>
                    )}
                    {isUnderworked && (
                      <Badge variant="secondary" className="text-xs">
                        Unterausgelastet
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Team-Statistiken</CardTitle>
            <CardDescription>
              Übersicht der Teamleistung und Auslastung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Mitarbeiter</TableHead>
                  <TableHead className="text-right">Schichten</TableHead>
                  <TableHead className="text-right">Ø Stunden</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamStats.map(({ team, employeeCount, totalAssignments, averageHours }) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell className="text-right">{employeeCount}</TableCell>
                    <TableCell className="text-right">{totalAssignments}</TableCell>
                    <TableCell className="text-right">{averageHours.toFixed(1)}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Shift Type Utilization */}
      <Card>
        <CardHeader>
          <CardTitle>Schichttyp-Auslastung</CardTitle>
          <CardDescription>
            Analyse der Besetzung nach Schichttypen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shiftTypeUtilization.map(({ shiftType, totalRequired, totalAssigned, utilizationPercentage, isUnderStaffed }) => (
              <div key={shiftType.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{shiftType.name}</span>
                    <span className="text-sm text-gray-500">
                      ({shiftType.startTime} - {shiftType.endTime})
                    </span>
                    {isUnderStaffed && (
                      <Badge variant="destructive" className="text-xs">
                        Unterbesetzt
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm">
                    {totalAssigned}/{totalRequired} ({utilizationPercentage.toFixed(0)}%)
                  </div>
                </div>
                <Progress
                  value={utilizationPercentage}
                  className={`h-2 ${isUnderStaffed ? 'bg-red-100' : ''}`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Planungskonflikte</span>
            </CardTitle>
            <CardDescription>
              Konflikte und Probleme bei der Schichtplanung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {conflicts.map((conflict, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded p-2">
                  <div className="text-sm text-red-700">{conflict}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
