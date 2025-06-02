'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Plus, Edit, Copy, Download, Upload } from 'lucide-react';
import { useData } from './DataProvider';
import { useToast } from '@/hooks/use-toast';
import { saveShiftRule, updateShiftRule, deleteShiftRule } from '@/lib/dataManager';
import type { ShiftRule } from '@/lib/types';

interface ShiftRuleFormData {
  type: 'forbidden_sequence' | 'mandatory_follow_up';
  fromShiftId: string;
  toShiftId?: string;
  toShiftIds?: string[];
  sameDay?: boolean;
}

export function ShiftRuleManagement() {
  const { shiftRules, shiftTypes, refreshData } = useData();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ShiftRule | null>(null);
  const [formData, setFormData] = useState<ShiftRuleFormData>({
    type: 'forbidden_sequence',
    fromShiftId: '',
    toShiftIds: [],
    sameDay: false,
  });

  const resetForm = () => {
    setFormData({
      type: 'forbidden_sequence',
      fromShiftId: '',
      toShiftIds: [],
      sameDay: false,
    });
    setEditingRule(null);
  };

  const handleOpenDialog = (rule?: ShiftRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        type: rule.type,
        fromShiftId: rule.fromShiftId,
        toShiftId: rule.toShiftId,
        toShiftIds: rule.toShiftIds || [],
        sameDay: rule.sameDay,
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

    if (!formData.fromShiftId) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie eine Ausgangsschicht.",
        variant: "destructive",
      });
      return;
    }

    // Validation based on rule type
    if (formData.type === 'forbidden_sequence') {
      if (!formData.toShiftIds || formData.toShiftIds.length === 0) {
        toast({
          title: "Fehler",
          description: "Bitte wählen Sie mindestens eine verbotene Folgeschicht.",
          variant: "destructive",
        });
        return;
      }
    } else if (formData.type === 'mandatory_follow_up') {
      if (!formData.toShiftId) {
        toast({
          title: "Fehler",
          description: "Bitte wählen Sie eine verpflichtende Folgeschicht.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // Generate rule name
      const fromShift = shiftTypes.find(st => st.id === formData.fromShiftId);
      let ruleName = '';

      if (formData.type === 'forbidden_sequence') {
        const toShiftNames = formData.toShiftIds?.map(id => {
          const st = shiftTypes.find(s => s.id === id);
          return st ? st.name : 'Unbekannt';
        }).join(', ') || '';
        ruleName = `Verbot: ${fromShift?.name} -> ${toShiftNames}`;
      } else {
        const toShift = shiftTypes.find(st => st.id === formData.toShiftId);
        ruleName = `Muss: ${fromShift?.name} -> ${toShift?.name}`;
      }

      const ruleData = {
        ...formData,
        name: ruleName,
      };

      if (editingRule) {
        updateShiftRule(editingRule.id, ruleData);
        toast({
          title: "Erfolgreich",
          description: "Schichtregel wurde aktualisiert.",
        });
      } else {
        saveShiftRule(ruleData);
        toast({
          title: "Erfolgreich",
          description: "Schichtregel wurde hinzugefügt.",
        });
      }
      refreshData();
      handleCloseDialog();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern der Schichtregel.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (rule: ShiftRule) => {
    if (window.confirm(`Möchten Sie die Regel "${rule.name}" wirklich löschen?`)) {
      try {
        deleteShiftRule(rule.id);
        toast({
          title: "Erfolgreich",
          description: "Schichtregel wurde gelöscht.",
        });
        refreshData();
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen der Schichtregel.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDuplicate = (rule: ShiftRule) => {
    setFormData({
      type: rule.type,
      fromShiftId: rule.fromShiftId,
      toShiftId: rule.toShiftId,
      toShiftIds: rule.toShiftIds || [],
      sameDay: rule.sameDay,
    });
    setEditingRule(null);
    setIsDialogOpen(true);
  };

  const handleToShiftToggle = (shiftTypeId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      toShiftIds: checked
        ? [...(prev.toShiftIds || []), shiftTypeId]
        : (prev.toShiftIds || []).filter(id => id !== shiftTypeId),
    }));
  };

  const formatRuleDescription = (rule: ShiftRule) => {
    const fromShift = shiftTypes.find(st => st.id === rule.fromShiftId);
    const fromName = fromShift ? fromShift.name : 'Unbekannt';

    if (rule.type === 'forbidden_sequence') {
      const toShiftNames = rule.toShiftIds?.map(id => {
        const st = shiftTypes.find(s => s.id === id);
        return st ? st.name : 'Unbekannt';
      }).join(', ') || '';
      return `Nicht ${toShiftNames} ${rule.sameDay ? 'am selben Tag' : 'am Folgetag'} nach ${fromName}.`;
    }
    const toShift = shiftTypes.find(st => st.id === rule.toShiftId);
    const toName = toShift ? toShift.name : 'Unbekannt';
    return `Wenn ${fromName}, dann muss ${toName} (am selben Tag).`;
  };

  const formatRuleType = (type: string) => {
    switch (type) {
      case 'forbidden_sequence':
        return 'Verbotene Schichtfolge';
      case 'mandatory_follow_up':
        return 'Verpflichtende Folgeschicht';
      default:
        return type;
    }
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Regel hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Schichtregel bearbeiten' : 'Schichtregel hinzufügen'}
              </DialogTitle>
              <DialogDescription>
                Definieren Sie Regeln für Schichtfolgen und Arbeitsverteilungen.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="type">Regeltyp *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'forbidden_sequence' | 'mandatory_follow_up') => {
                    setFormData(prev => ({
                      ...prev,
                      type: value,
                      toShiftId: '',
                      toShiftIds: [],
                      sameDay: false,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forbidden_sequence">Verbotene Schichtfolge</SelectItem>
                    <SelectItem value="mandatory_follow_up">Verpflichtende Folgeschicht</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="fromShiftId">Wenn Schicht *</Label>
                <Select
                  value={formData.fromShiftId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, fromShiftId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Schicht auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftTypes.map(shiftType => (
                      <SelectItem key={shiftType.id} value={shiftType.id}>
                        {shiftType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.type === 'forbidden_sequence' && (
                <>
                  <div>
                    <Label>Dann nicht folgende Schichten *</Label>
                    <Card className="p-4 mt-2 max-h-40 overflow-y-auto">
                      <div className="space-y-2">
                        {shiftTypes.map(shiftType => (
                          <div key={shiftType.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`to-shift-${shiftType.id}`}
                              checked={formData.toShiftIds?.includes(shiftType.id) || false}
                              onCheckedChange={(checked) => handleToShiftToggle(shiftType.id, !!checked)}
                            />
                            <Label htmlFor={`to-shift-${shiftType.id}`} className="text-sm">
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
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sameDay"
                      checked={formData.sameDay || false}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sameDay: !!checked }))}
                    />
                    <Label htmlFor="sameDay" className="text-sm">
                      Verboten am selben Tag (sonst am Folgetag)
                    </Label>
                  </div>
                </>
              )}

              {formData.type === 'mandatory_follow_up' && (
                <div>
                  <Label htmlFor="toShiftId">Dann muss Schicht (selber Tag) *</Label>
                  <Select
                    value={formData.toShiftId || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, toShiftId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Schicht auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftTypes.map(shiftType => (
                        <SelectItem key={shiftType.id} value={shiftType.id}>
                          {shiftType.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Abbrechen
                </Button>
                {editingRule && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      handleDelete(editingRule);
                      handleCloseDialog();
                    }}
                  >
                    Löschen
                  </Button>
                )}
                <Button type="submit">
                  {editingRule ? 'Aktualisieren' : 'Hinzufügen'}
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
              <TableHead>Regeltyp</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shiftRules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                  Keine Schichtregeln gefunden.
                </TableCell>
              </TableRow>
            ) : (
              shiftRules.map(rule => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{formatRuleType(rule.type)}</TableCell>
                  <TableCell>{formatRuleDescription(rule)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(rule)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(rule)}
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
