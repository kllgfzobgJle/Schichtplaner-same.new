'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Download, Upload, Trash2, BarChart3, Calendar, AlertTriangle } from 'lucide-react';
import { useData } from './DataProvider';
import { useToast } from '@/hooks/use-toast';
import { generateShiftSchedule } from '@/lib/shiftScheduler';
import { ShiftCalendarGrid } from './ShiftCalendarGrid';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { saveShiftPlan, getShiftPlans, deleteShiftPlan } from '@/lib/dataManager';
import type { ShiftAssignment, ShiftPlan, WorkloadStats } from '@/lib/types';

export function ShiftPlanner() {
  const { employees, teams, shiftTypes, learningYearQualifications, shiftRules, refreshData } = useData();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [planName, setPlanName] = useState('');
  const [currentAssignments, setCurrentAssignments] = useState<ShiftAssignment[]>([]);
  const [currentConflicts, setCurrentConflicts] = useState<string[]>([]);
  const [currentWorkloadStats, setCurrentWorkloadStats] = useState<Record<string, WorkloadStats>>({});
  const [savedPlans, setSavedPlans] = useState<ShiftPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Load saved plans
  const loadSavedPlans = () => {
    const plans = getShiftPlans();
    setSavedPlans(plans);
  };

  // Auto-calculate end date when start date changes (4 weeks later)
  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    if (date) {
      const start = new Date(date);
      // Adjust to Monday if not already
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);

      // Add 27 days (4 weeks - 1) to get the end date
      const end = new Date(start);
      end.setDate(start.getDate() + 27);

      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const handleGeneratePlan = async () => {
    if (!startDate) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie ein Startdatum.",
        variant: "destructive",
      });
      return;
    }

    if (employees.length === 0) {
      toast({
        title: "Fehler",
        description: "Keine Mitarbeiter definiert. Bitte fügen Sie zuerst Mitarbeiter hinzu.",
        variant: "destructive",
      });
      return;
    }

    if (shiftTypes.length === 0) {
      toast({
        title: "Fehler",
        description: "Keine Schichttypen definiert. Bitte fügen Sie zuerst Schichttypen hinzu.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const scheduleOptions = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        employees,
        teams,
        shiftTypes,
        learningYearQualifications,
        shiftRules,
        existingAssignments: currentAssignments,
      };

      const result = generateShiftSchedule(scheduleOptions);

      setCurrentAssignments(result.assignments);
      setCurrentConflicts(result.conflicts);
      setCurrentWorkloadStats(result.statistics.employeeWorkloads);

      toast({
        title: "Plan generiert",
        description: `${result.assignments.length} Zuweisungen erstellt${result.conflicts.length > 0 ? ` mit ${result.conflicts.length} Konflikten` : ''}.`,
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler bei der Plan-Generierung.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePlan = () => {
    if (!planName) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Namen für den Plan ein.",
        variant: "destructive",
      });
      return;
    }

    if (currentAssignments.length === 0) {
      toast({
        title: "Fehler",
        description: "Kein Plan zum Speichern vorhanden. Bitte generieren Sie zuerst einen Plan.",
        variant: "destructive",
      });
      return;
    }

    try {
      const planData = {
        planName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        assignments: currentAssignments,
      };

      saveShiftPlan(planData);
      loadSavedPlans();
      setPlanName('');

      toast({
        title: "Plan gespeichert",
        description: `Plan "${planName}" wurde erfolgreich gespeichert.`,
      });
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Plans.",
        variant: "destructive",
      });
    }
  };

  const handleLoadPlan = () => {
    if (!selectedPlanId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie einen Plan zum Laden aus.",
        variant: "destructive",
      });
      return;
    }

    const plan = savedPlans.find(p => p.id === selectedPlanId);
    if (!plan) {
      toast({
        title: "Fehler",
        description: "Plan nicht gefunden.",
        variant: "destructive",
      });
      return;
    }

    setStartDate(plan.startDate.toISOString().split('T')[0]);
    setEndDate(plan.endDate.toISOString().split('T')[0]);
    setCurrentAssignments(plan.assignments);
    setPlanName(plan.planName || '');

    // Recalculate statistics and conflicts
    const scheduleOptions = {
      startDate: plan.startDate,
      endDate: plan.endDate,
      employees,
      teams,
      shiftTypes,
      learningYearQualifications,
      shiftRules,
      existingAssignments: plan.assignments,
    };

    const result = generateShiftSchedule(scheduleOptions);
    setCurrentConflicts(result.conflicts);
    setCurrentWorkloadStats(result.statistics.employeeWorkloads);

    toast({
      title: "Plan geladen",
      description: `Plan "${plan.planName}" wurde geladen.`,
    });
  };

  const handleDeletePlan = () => {
    if (!selectedPlanId) return;

    const plan = savedPlans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    if (window.confirm(`Möchten Sie den Plan "${plan.planName}" wirklich löschen?`)) {
      try {
        deleteShiftPlan(selectedPlanId);
        loadSavedPlans();
        setSelectedPlanId('');

        toast({
          title: "Plan gelöscht",
          description: `Plan "${plan.planName}" wurde gelöscht.`,
        });
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen des Plans.",
          variant: "destructive",
        });
      }
    }
  };

  const handleAssignmentChange = (newAssignments: ShiftAssignment[]) => {
    setCurrentAssignments(newAssignments);

    // Recalculate conflicts and statistics
    if (startDate && endDate) {
      const scheduleOptions = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        employees,
        teams,
        shiftTypes,
        learningYearQualifications,
        shiftRules,
        existingAssignments: newAssignments,
      };

      const result = generateShiftSchedule(scheduleOptions);
      setCurrentConflicts(result.conflicts);
      setCurrentWorkloadStats(result.statistics.employeeWorkloads);
    }
  };

  // Auto-set start date to next Monday and load saved plans on component mount
  if (!startDate) {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    handleStartDateChange(monday.toISOString().split('T')[0]);
    loadSavedPlans();
  }

  return (
    <div className="space-y-6">
      {/* Plan Generation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarDays className="w-5 h-5 mr-2" />
            Schichtplan-Erstellung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="startDate">Startdatum (Montag)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Enddatum (automatisch)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                readOnly
                className="bg-gray-100"
              />
            </div>
            <div>
              <Button
                onClick={handleGeneratePlan}
                className="w-full"
                disabled={isGenerating}
              >
                {isGenerating ? "Generiere..." : "Plan generieren"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saved Plans Section */}
      <Card>
        <CardHeader>
          <CardTitle>Gespeicherte Pläne</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <Label htmlFor="savedPlans">Plan auswählen</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Gespeicherten Plan auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {savedPlans.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Keine Pläne gespeichert
                    </SelectItem>
                  ) : (
                    savedPlans.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.planName} ({plan.startDate.toLocaleDateString('de-DE')})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleLoadPlan}
                disabled={!selectedPlanId}
              >
                Plan laden
              </Button>
            </div>
            <div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDeletePlan}
                disabled={!selectedPlanId}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Plan löschen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Current Plan Section */}
      <Card>
        <CardHeader>
          <CardTitle>Aktuellen Plan speichern</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <Label htmlFor="planName">Plan speichern als:</Label>
              <Input
                id="planName"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Name für diesen Plan..."
              />
            </div>
            <div>
              <Button
                onClick={handleSavePlan}
                variant="outline"
                className="w-full"
                disabled={currentAssignments.length === 0}
              >
                Plan speichern
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan Display and Analytics */}
      {currentAssignments.length > 0 && startDate && endDate ? (
        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar" className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Kalenderansicht</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analyse</span>
              {currentConflicts.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {currentConflicts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Schichtplan Kalender</span>
                  <div className="flex items-center space-x-2">
                    {currentConflicts.length > 0 && (
                      <Badge variant="destructive" className="flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{currentConflicts.length} Konflikte</span>
                      </Badge>
                    )}
                    <Badge variant="secondary">
                      {currentAssignments.filter(a => !a.isFollowUp).length} Zuweisungen
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ShiftCalendarGrid
                  startDate={new Date(startDate)}
                  endDate={new Date(endDate)}
                  employees={employees}
                  shiftTypes={shiftTypes}
                  assignments={currentAssignments}
                  conflicts={currentConflicts}
                  onAssignmentChange={handleAssignmentChange}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsDashboard
              employees={employees}
              teams={teams}
              shiftTypes={shiftTypes}
              assignments={currentAssignments}
              workloadStats={currentWorkloadStats}
              conflicts={currentConflicts}
              startDate={new Date(startDate)}
              endDate={new Date(endDate)}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Schichtplan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-gray-200 rounded-md p-8 text-center text-gray-500">
              <CalendarDays className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">Kein Plan generiert</p>
              <p className="text-sm">
                Wählen Sie ein Startdatum und klicken Sie auf "Plan generieren" oder laden Sie einen gespeicherten Plan.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{employees.length}</div>
              <div className="text-sm text-gray-600">Mitarbeiter</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{teams.length}</div>
              <div className="text-sm text-gray-600">Teams</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{shiftTypes.length}</div>
              <div className="text-sm text-gray-600">Schichttypen</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
