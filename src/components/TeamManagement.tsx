'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Copy, Download, Upload } from 'lucide-react';
import { useData } from './DataProvider';
import { useToast } from '@/hooks/use-toast';
import { saveTeam, updateTeam, deleteTeam } from '@/lib/dataManager';
import { teamsToCSV, csvToTeams, downloadCSV } from '@/lib/csvUtils';
import type { Team } from '@/lib/types';

interface TeamFormData {
  name: string;
  overallShiftPercentage: number;
}

export function TeamManagement() {
  const { teams, refreshData } = useData();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    overallShiftPercentage: 60,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      overallShiftPercentage: 60,
    });
    setEditingTeam(null);
  };

  const handleOpenDialog = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        overallShiftPercentage: team.overallShiftPercentage,
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

    if (!formData.name || formData.overallShiftPercentage < 0 || formData.overallShiftPercentage > 100) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen gültigen Teamnamen und Prozentsatz (0-100) ein.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingTeam) {
        updateTeam(editingTeam.id, formData);
        toast({
          title: "Erfolgreich",
          description: "Team wurde aktualisiert.",
        });
      } else {
        saveTeam(formData);
        toast({
          title: "Erfolgreich",
          description: "Team wurde hinzugefügt.",
        });
      }
      refreshData();
      handleCloseDialog();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Teams.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (team: Team) => {
    if (window.confirm(`Möchten Sie das Team "${team.name}" wirklich löschen?`)) {
      try {
        deleteTeam(team.id);
        toast({
          title: "Erfolgreich",
          description: "Team wurde gelöscht.",
        });
        refreshData();
      } catch (error) {
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen des Teams.",
          variant: "destructive",
        });
      }
    }
  };

  const handleDuplicate = (team: Team) => {
    setFormData({
      name: `${team.name} (Kopie)`,
      overallShiftPercentage: team.overallShiftPercentage,
    });
    setEditingTeam(null);
    setIsDialogOpen(true);
  };

  // CSV Export
  const handleExportCSV = () => {
    try {
      const csvContent = teamsToCSV(teams);
      const filename = `teams_${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csvContent, filename);
      toast({
        title: "Export erfolgreich",
        description: "Teamdaten wurden als CSV exportiert.",
      });
    } catch (error) {
      toast({
        title: "Export fehlgeschlagen",
        description: "Fehler beim Exportieren der Teamdaten.",
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
        const importedTeams = csvToTeams(csvContent);

        if (importedTeams.length === 0) {
          toast({
            title: "Import fehlgeschlagen",
            description: "Keine gültigen Teamdaten in der CSV-Datei gefunden.",
            variant: "destructive",
          });
          return;
        }

        // Save imported teams
        for (const teamData of importedTeams) {
          saveTeam(teamData);
        }

        refreshData();
        toast({
          title: "Import erfolgreich",
          description: `${importedTeams.length} Teams wurden importiert.`,
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
              Team hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTeam ? 'Team bearbeiten' : 'Team hinzufügen'}
              </DialogTitle>
              <DialogDescription>
                Erfassen Sie die Teamdaten und den Gesamtschichtanteil.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Teamname *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="overallShiftPercentage">Gesamtschichtanteil (%) *</Label>
                <Input
                  id="overallShiftPercentage"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.overallShiftPercentage}
                  onChange={(e) => setFormData(prev => ({ ...prev, overallShiftPercentage: Number(e.target.value) }))}
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Abbrechen
                </Button>
                {editingTeam && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      handleDelete(editingTeam);
                      handleCloseDialog();
                    }}
                  >
                    Löschen
                  </Button>
                )}
                <Button type="submit">
                  {editingTeam ? 'Aktualisieren' : 'Hinzufügen'}
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
              <TableHead>Gesamtschichtanteil (%)</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                  Keine Teams gefunden.
                </TableCell>
              </TableRow>
            ) : (
              teams.map(team => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.overallShiftPercentage}%</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(team)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(team)}
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
