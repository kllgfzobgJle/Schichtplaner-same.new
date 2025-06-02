'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Edit, Download, Upload } from 'lucide-react';
import { useData } from './DataProvider';
import { useToast } from '@/hooks/use-toast';
import { updateLearningYearQualification } from '@/lib/dataManager';
import type { LearningYearQualification } from '@/lib/types';
import { WEEKDAYS, HALF_DAYS, WEEKDAYS_SHORT, HALF_DAYS_GERMAN } from '@/lib/types';

interface LearningYearFormData {
  jahr: number;
  qualifiedShiftTypes: string[];
  defaultAvailability: Record<string, boolean>;
}

export function LearningYearManagement() {
  const { learningYearQualifications, shiftTypes, refreshData } = useData();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<LearningYearFormData>({
    jahr: 1,
    qualifiedShiftTypes: [],
    defaultAvailability: {},
  });

  const handleOpenDialog = (qualification: LearningYearQualification) => {
    setFormData({
      jahr: qualification.jahr,
      qualifiedShiftTypes: qualification.qualifiedShiftTypes,
      defaultAvailability: qualification.defaultAvailability,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      updateLearningYearQualification(formData.jahr, {
        qualifiedShiftTypes: formData.qualifiedShiftTypes,
        defaultAvailability: formData.defaultAvailability,
      });
      toast({
        title: "Erfolgreich",
        description: `Qualifikationen für ${formData.jahr}. Lehrjahr wurden gespeichert.`,
      });
      refreshData();
      handleCloseDialog();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern der Lehrjahr-Qualifikationen.",
        variant: "destructive",
      });
    }
  };

  const handleShiftTypeChange = (shiftTypeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      qualifiedShiftTypes: checked
        ? [...prev.qualifiedShiftTypes, shiftTypeId]
        : prev.qualifiedShiftTypes.filter(id => id !== shiftTypeId),
    }));
  };

  const handleAvailabilityChange = (dayKey: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      defaultAvailability: {
        ...prev.defaultAvailability,
        [dayKey]: checked,
      },
    }));
  };

  const getShiftTypeNames = (shiftTypeIds: string[]) => {
    if (!shiftTypeIds || shiftTypeIds.length === 0) return 'Keine';
    return shiftTypeIds.map(id => {
      const shiftType = shiftTypes.find(st => st.id === id);
      return shiftType ? shiftType.name : 'Unbekannt';
    }).join(', ');
  };

  const formatAvailability = (availability: Record<string, boolean>) => {
    return WEEKDAYS.map(day => {
      const am = availability[`${day}_AM`];
      const pm = availability[`${day}_PM`];
      if (am && pm) return `${WEEKDAYS_SHORT[day]}: Beide`;
      if (am) return `${WEEKDAYS_SHORT[day]}: VM`;
      if (pm) return `${WEEKDAYS_SHORT[day]}: NM`;
      return `${WEEKDAYS_SHORT[day]}: -`;
    }).join('; ');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex space-x-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lehrjahr</TableHead>
              <TableHead>Qualifizierte Schichten</TableHead>
              <TableHead>Standard Verfügbarkeit</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {learningYearQualifications.map(qualification => (
              <TableRow key={qualification.id}>
                <TableCell className="font-medium">{qualification.jahr}. Lehrjahr</TableCell>
                <TableCell className="max-w-xs truncate" title={getShiftTypeNames(qualification.qualifiedShiftTypes)}>
                  {getShiftTypeNames(qualification.qualifiedShiftTypes)}
                </TableCell>
                <TableCell className="max-w-sm truncate" title={formatAvailability(qualification.defaultAvailability)}>
                  {formatAvailability(qualification.defaultAvailability)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDialog(qualification)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formData.jahr}. Lehrjahr Qualifikationen bearbeiten
            </DialogTitle>
            <DialogDescription>
              Konfigurieren Sie die erlaubten Schichten und Standard-Verfügbarkeit für dieses Lehrjahr.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="jahr">Lehrjahr</Label>
              <Select value={formData.jahr.toString()} disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1. Lehrjahr</SelectItem>
                  <SelectItem value="2">2. Lehrjahr</SelectItem>
                  <SelectItem value="3">3. Lehrjahr</SelectItem>
                  <SelectItem value="4">4. Lehrjahr</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Qualifizierte Schichten</Label>
              <Card className="p-4 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  {shiftTypes.map(shiftType => (
                    <div key={shiftType.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`shift-${shiftType.id}`}
                        checked={formData.qualifiedShiftTypes.includes(shiftType.id)}
                        onCheckedChange={(checked) => handleShiftTypeChange(shiftType.id, !!checked)}
                      />
                      <Label htmlFor={`shift-${shiftType.id}`} className="text-sm">
                        {shiftType.name}
                      </Label>
                    </div>
                  ))}
                </div>
                {shiftTypes.length === 0 && (
                  <p className="text-sm text-gray-500">Keine Schichttypen definiert.</p>
                )}
              </Card>
            </div>

            <div>
              <Label>Standard Verfügbarkeit</Label>
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
                              checked={formData.defaultAvailability[key] !== false}
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
              <Button type="submit">
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
