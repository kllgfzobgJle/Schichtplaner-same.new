'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Copy, Download, Upload } from 'lucide-react';
import { useData } from './DataProvider';
import { useToast } from '@/hooks/use-toast';
import { saveShiftType, updateShiftType, deleteShiftType } from '@/lib/dataManager';
import { shiftTypesToCSV, csvToShiftTypes, downloadCSV } from '@/lib/csvUtils';
import type { ShiftType } from '@/lib/types';
import { WEEKDAYS, WEEKDAYS_GERMAN } from '@/lib/types';

interface ShiftTypeFormData {
  name: string;
  startTime: string;
  endTime: string;
  weeklyNeeds: Record<string, number>;
}

export function ShiftTypeManagement() {
  const { shiftTypes, refreshData } = useData();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingShiftType, setEditingShiftType] = useState<ShiftType | null>(null);
  const [formData, setFormData] = useState<ShiftTypeFormData>({
    name: '',
    startTime: '08:00',
    endTime: '16:00',
    weeklyNeeds: {},
  });

  const resetForm = () => {
    setFormData({
      name: '',
      startTime: '08:00',
      endTime: '16:00',
      weeklyNeeds: {},
    });
    setEditingShiftType(null);
  };

  const handleOpenDialog = (shiftType?: ShiftType) => {
    if (shiftType) {
      setEditingShiftType(shiftType);
      setFormData({
        name: shiftType.name,
        startTime: shiftType.startTime,
        endTime: shiftType.endTime,
        weeklyNeeds: shiftType.weeklyNeeds,
      });
    } else {
      resetForm();
      // Set default weekly needs to 1 for all weekdays
      const defaultNeeds: Record<string, number> = {};
      for (const day of WEEKDAYS) {
        defaultNeeds[day] = 1;
      }
      setFormData(prev => ({ ...prev, weeklyNeeds: defaultNeeds }));
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.startTime || !formData.endTime) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie Name, Start- und Endzeit aus.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingShiftType) {
        updateShiftType(editingShiftType.id, formData);
        toast({
          title: "Erfolgreich",
          description: "Schichttyp wurde aktualisiert.",
        });
      } else {
        saveShiftType(formData);
        toast({
          title: "Erfolgreich",
          description: "Schichttyp wurde hinzugefügt.",
        });
      }
      refreshData();
      handleCloseDialog();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Schichttyps.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (shiftType: ShiftType) => {
    if (window.confirm(`Möchten Sie den Schichttyp "${shiftType.name}" wirklich löschen?`)) {
      try {
        deleteShiftType(shiftType.id);
        toast({
          title: "Erfolgreich",
          description: "Schichttyp wurde gelöscht.",
        });
        refreshData();
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen des Schichttyps.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDuplicate = (shiftType: ShiftType) => {
    setFormData({
      name: `${shiftType.name} (Kopie)`,
      startTime: shiftType.startTime,
      endTime: shiftType.endTime,
      weeklyNeeds: shiftType.weeklyNeeds,
    });
    setEditingShiftType(null);
    setIsDialogOpen(true);
  };

  const handleWeeklyNeedChange = (day: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      weeklyNeeds: {
        ...prev.weeklyNeeds,
        [day]: Math.max(0, value),
      },
    }));
  };

  const formatWeeklyNeeds = (weeklyNeeds: Record<string, number>) => {
    return WEEKDAYS.map(day => {
      const need = weeklyNeeds[day] || 0;
      return `${WEEKDAYS_GERMAN[day].substring(0, 2)}: ${need}`;
    }).join(', ');
  };

  // CSV Export
  const handleExportCSV = () => {
    try {
      const csvContent = shiftTypesToCSV(shiftTypes);
      const filename = `schichttypen_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csvContent, filename);
      toast({
        title: "Export erfolgreich",
        description: "Schichttyp-Daten wurden als CSV exportiert.",
      });
    } catch (error) {
      toast({
        title: "Export fehlgeschlagen",
        description: "Fehler beim Exportieren der Schichttyp-Daten.",
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
        const importedShiftTypes = csvToShiftTypes(csvContent);

        if (importedShiftTypes.length === 0) {
          toast({
            title: "Import fehlgeschlagen",
            description: "Keine gültigen Schichttyp-Daten in der CSV-Datei gefunden.",
            variant: "destructive",
          });
          return;
        }

        // Save imported shift types
        for (const shiftTypeData of importedShiftTypes) {
          saveShiftType(shiftTypeData);
        }

        refreshData();
        toast({
          title: "Import erfolgreich",
          description: `${importedShiftTypes.length} Schichttypen wurden importiert.`,
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
              Schichttyp hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingShiftType ? 'Schichttyp bearbeiten' : 'Schichttyp hinzufügen'}
              </DialogTitle>
              <DialogDescription>
                Definieren Sie Schichtzeiten und wöchentliche Bedarfe.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="startTime">Startzeit *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">Endzeit *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>Tagesbedarf (Mo-Fr)</Label>
                <Card className="p-4 mt-2">
                  <div className="grid grid-cols-5 gap-4">
                    {WEEKDAYS.map(day => (
                      <div key={day}>
                        <Label htmlFor={`need-${day}`} className="text-sm">
                          {WEEKDAYS_GERMAN[day]}
                        </Label>
                        <Input
                          id={`need-${day}`}
                          type="number"
                          min="0"
                          value={formData.weeklyNeeds[day] || 0}
                          onChange={(e) => handleWeeklyNeedChange(day, Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Abbrechen
                </Button>
                {editingShiftType && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      handleDelete(editingShiftType);
                      handleCloseDialog();
                    }}
                  >
                    Löschen
                  </Button>
                )}
                <Button type="submit">
                  {editingShiftType ? 'Aktualisieren' : 'Hinzufügen'}
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
              <TableHead>Name</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Ende</TableHead>
              <TableHead>Bedarf (Mo-Fr)</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shiftTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4 text-gray-500">
                  Keine Schichttypen gefunden.
                </TableCell>
              </TableRow>
            ) : (
              shiftTypes.map(shiftType => (
                <TableRow key={shiftType.id}>
                  <TableCell className="font-medium">{shiftType.name}</TableCell>
                  <TableCell>{shiftType.startTime}</TableCell>
                  <TableCell>{shiftType.endTime}</TableCell>
                  <TableCell className="max-w-xs truncate" title={formatWeeklyNeeds(shiftType.weeklyNeeds)}>
                    {formatWeeklyNeeds(shiftType.weeklyNeeds)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(shiftType)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(shiftType)}
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
