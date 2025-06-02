'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Copy, Trash2, Download, Upload } from 'lucide-react';
import { useData } from './DataProvider';
import { useToast } from '@/hooks/use-toast';
import { saveEmployee, updateEmployee, deleteEmployee } from '@/lib/dataManager';
import { employeesToCSV, csvToEmployees, downloadCSV } from '@/lib/csvUtils';
import type { Employee } from '@/lib/types';
import { WEEKDAYS, HALF_DAYS, WEEKDAYS_SHORT, HALF_DAYS_GERMAN } from '@/lib/types';

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  kuerzel: string;
  employeeType: 'ausgelernt' | 'azubi';
  lehrjahr?: number;
  grade: number;
  teamId: string;
  specificShiftPercentage?: number;
  allowedShifts: string[];
  availability: Record<string, boolean>;
}

export function EmployeeManagement() {
  const { employees, teams, shiftTypes, learningYearQualifications, refreshData } = useData();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>({
    firstName: '',
    lastName: '',
    kuerzel: '',
    employeeType: 'ausgelernt',
    grade: 100,
    teamId: '',
    allowedShifts: [],
    availability: {},
  });

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      kuerzel: '',
      employeeType: 'ausgelernt',
      grade: 100,
      teamId: '',
      allowedShifts: [],
      availability: {},
    });
    setEditingEmployee(null);
  };

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        firstName: employee.firstName,
        lastName: employee.lastName,
        kuerzel: employee.kuerzel || '',
        employeeType: employee.employeeType,
        lehrjahr: employee.lehrjahr,
        grade: employee.grade,
        teamId: employee.teamId,
        specificShiftPercentage: employee.specificShiftPercentage,
        allowedShifts: employee.allowedShifts,
        availability: employee.availability,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.teamId) {
      toast({
        title: "Fehler",
        description: "Bitte alle Pflichtfelder ausfüllen.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingEmployee) {
        updateEmployee(editingEmployee.id, formData);
        toast({
          title: "Erfolgreich",
          description: "Mitarbeiter wurde aktualisiert.",
        });
      } else {
        saveEmployee(formData);
        toast({
          title: "Erfolgreich",
          description: "Mitarbeiter wurde hinzugefügt.",
        });
      }
      refreshData();
      handleCloseDialog();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Mitarbeiters.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (employee: Employee) => {
    if (window.confirm(`Möchten Sie ${employee.firstName} ${employee.lastName} wirklich löschen?`)) {
      try {
        deleteEmployee(employee.id);
        toast({
          title: "Erfolgreich",
          description: "Mitarbeiter wurde gelöscht.",
        });
        refreshData();
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen des Mitarbeiters.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDuplicate = (employee: Employee) => {
    setFormData({
      firstName: employee.firstName,
      lastName: `${employee.lastName} (Kopie)`,
      kuerzel: employee.kuerzel ? `${employee.kuerzel.substring(0, 3)}K` : '',
      employeeType: employee.employeeType,
      lehrjahr: employee.lehrjahr,
      grade: employee.grade,
      teamId: employee.teamId,
      specificShiftPercentage: employee.specificShiftPercentage,
      allowedShifts: employee.allowedShifts,
      availability: employee.availability,
    });
    setEditingEmployee(null);
    setIsDialogOpen(true);
  };

  const handleAvailabilityChange = (dayKey: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [dayKey]: checked,
      },
    }));
  };

  const handleShiftTypeChange = (shiftTypeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      allowedShifts: checked
        ? [...prev.allowedShifts, shiftTypeId]
        : prev.allowedShifts.filter(id => id !== shiftTypeId),
    }));
  };

  // Update availability when lehrjahr changes for azubi
  const handleLehrjahrChange = (lehrjahr: number) => {
    setFormData(prev => {
      const qualification = learningYearQualifications.find(q => q.jahr === lehrjahr);
      return {
        ...prev,
        lehrjahr,
        availability: qualification?.defaultAvailability || {},
      };
    });
  };

  const getTeamName = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.name : 'Unbekannt';
  };

  // CSV Export
  const handleExportCSV = () => {
    try {
      const csvContent = employeesToCSV(employees);
      const filename = `mitarbeiter_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csvContent, filename);
      toast({
        title: "Export erfolgreich",
        description: "Mitarbeiterdaten wurden als CSV exportiert.",
      });
    } catch (error) {
      toast({
        title: "Export fehlgeschlagen",
        description: "Fehler beim Exportieren der Mitarbeiterdaten.",
        variant: "destructive",
      });
    }
  };

  // CSV Import
  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result as string;
        const importedEmployees = csvToEmployees(csvContent);

        if (importedEmployees.length === 0) {
          toast({
            title: "Import fehlgeschlagen",
            description: "Keine gültigen Mitarbeiterdaten in der CSV-Datei gefunden.",
            variant: "destructive",
          });
          return;
        }

        // Save imported employees
        for (const employeeData of importedEmployees) {
          saveEmployee(employeeData);
        }

        refreshData();
        toast({
          title: "Import erfolgreich",
          description: `${importedEmployees.length} Mitarbeiter wurden importiert.`,
        });
      } catch (error) {
        toast({
          title: "Import fehlgeschlagen",
          description: "Fehler beim Verarbeiten der CSV-Datei. Bitte überprüfen Sie das Format.",
          variant: "destructive",
        });
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Mitarbeiter hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEmployee ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter hinzufügen'}
              </DialogTitle>
              <DialogDescription>
                Erfassen Sie die Mitarbeiterdaten und Verfügbarkeiten.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">Vorname *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Nachname *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="kuerzel">Kürzel (max. 4 Zeichen)</Label>
                  <Input
                    id="kuerzel"
                    value={formData.kuerzel}
                    onChange={(e) => setFormData(prev => ({ ...prev, kuerzel: e.target.value.slice(0, 4).toUpperCase() }))}
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label htmlFor="employeeType">Mitarbeitertyp *</Label>
                  <Select
                    value={formData.employeeType}
                    onValueChange={(value: 'ausgelernt' | 'azubi') => {
                      setFormData(prev => ({
                        ...prev,
                        employeeType: value,
                        lehrjahr: value === 'azubi' ? prev.lehrjahr : undefined,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ausgelernt">Ausgelernt</SelectItem>
                      <SelectItem value="azubi">Auszubildender</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.employeeType === 'azubi' && (
                  <div>
                    <Label htmlFor="lehrjahr">Lehrjahr *</Label>
                    <Select
                      value={formData.lehrjahr?.toString() || ''}
                      onValueChange={(value) => handleLehrjahrChange(Number(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Lehrjahr wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1. Lehrjahr</SelectItem>
                        <SelectItem value="2">2. Lehrjahr</SelectItem>
                        <SelectItem value="3">3. Lehrjahr</SelectItem>
                        <SelectItem value="4">4. Lehrjahr</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label htmlFor="grade">Anstellungsgrad (%) *</Label>
                  <Input
                    id="grade"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.grade}
                    onChange={(e) => setFormData(prev => ({ ...prev, grade: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="teamId">Team *</Label>
                  <Select
                    value={formData.teamId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, teamId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Team wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="specificShiftPercentage">Individueller Schichtanteil (%)</Label>
                  <Input
                    id="specificShiftPercentage"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.specificShiftPercentage || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      specificShiftPercentage: e.target.value ? Number(e.target.value) : undefined
                    }))}
                    placeholder="Leer = Team-Standard"
                  />
                </div>
              </div>

              <div>
                <Label>Erlaubte Schichten</Label>
                <Card className="p-4 mt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {shiftTypes.map(shiftType => (
                      <div key={shiftType.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`shift-${shiftType.id}`}
                          checked={formData.allowedShifts.includes(shiftType.id)}
                          onCheckedChange={(checked) => handleShiftTypeChange(shiftType.id, !!checked)}
                        />
                        <Label htmlFor={`shift-${shiftType.id}`} className="text-sm">
                          {shiftType.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div>
                <Label>Verfügbarkeit</Label>
                <Card className="p-4 mt-2">
                  <div className="grid grid-cols-6 gap-2 text-center">
                    <div />
                    {WEEKDAYS.map(day => (
                      <div key={day} className="font-medium text-sm">
                        {WEEKDAYS_SHORT[day]}
                      </div>
                    ))}
                    {HALF_DAYS.map(halfDay => (
                      <div key={halfDay} className="contents">
                        <div className="text-sm font-medium text-right pr-2">
                          {HALF_DAYS_GERMAN[halfDay]}
                        </div>
                        {WEEKDAYS.map(day => {
                          const key = `${day}_${halfDay}`;
                          return (
                            <div key={key} className="flex justify-center">
                              <Checkbox
                                checked={formData.availability[key] !== false}
                                onCheckedChange={(checked) => handleAvailabilityChange(key, !!checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Abbrechen
                </Button>
                {editingEmployee && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      handleDelete(editingEmployee);
                      handleCloseDialog();
                    }}
                  >
                    Löschen
                  </Button>
                )}
                <Button type="submit">
                  {editingEmployee ? 'Aktualisieren' : 'Hinzufügen'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vorname</TableHead>
              <TableHead>Nachname</TableHead>
              <TableHead>Anstellungsgrad</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                  Keine Mitarbeiter gefunden.
                </TableCell>
              </TableRow>
            ) : (
              employees.map(employee => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.firstName}</TableCell>
                  <TableCell>{employee.lastName}</TableCell>
                  <TableCell>{employee.grade}%</TableCell>
                  <TableCell>{getTeamName(employee.teamId)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(employee)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(employee)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
