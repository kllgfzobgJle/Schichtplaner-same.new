'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmployeeManagement } from './EmployeeManagement';
import { TeamManagement } from './TeamManagement';
import { ShiftTypeManagement } from './ShiftTypeManagement';
import { LearningYearManagement } from './LearningYearManagement';
import { ShiftRuleManagement } from './ShiftRuleManagement';
import { ShiftPlanner } from './ShiftPlanner';
import { DataProvider } from './DataProvider';
import { Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportAllData, importAllData } from '@/lib/dataManager';

export function SchichtplanerApp() {
  const [userId, setUserId] = useState<string>('demo-user-001');
  const { toast } = useToast();

  useEffect(() => {
    // Simulate user authentication
    const generateUserId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < 22; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const storedUserId = localStorage.getItem('schichtplaner-user-id');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = generateUserId();
      localStorage.setItem('schichtplaner-user-id', newUserId);
      setUserId(newUserId);
    }
  }, []);

  const handleExportAll = () => {
    try {
      exportAllData();
      toast({
        title: "Export erfolgreich",
        description: "Alle Daten wurden als JSON-Datei heruntergeladen.",
      });
    } catch (error) {
      toast({
        title: "Export fehlgeschlagen",
        description: "Fehler beim Exportieren der Daten.",
        variant: "destructive",
      });
    }
  };

  const handleImportAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        importAllData(result);
        toast({
          title: "Import erfolgreich",
          description: "Alle Daten wurden importiert. Die Seite wird neu geladen.",
        });
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        toast({
          title: "Import fehlgeschlagen",
          description: "Fehler beim Importieren der Daten. Bitte überprüfen Sie die Datei.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <DataProvider>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-slate-800 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Schichtplaner</h1>
                <p className="text-slate-300 text-sm">UserID: {userId}</p>
              </div>
              <div className="flex space-x-2">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportAll}
                  className="hidden"
                  id="import-file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-800 border-slate-300 bg-white hover:bg-slate-100"
                  onClick={() => document.getElementById('import-file')?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Globaler Import (JSON)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-800 border-slate-300 bg-white hover:bg-slate-100"
                  onClick={handleExportAll}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Globaler Export (JSON)
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs defaultValue="employees" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="employees">Mitarbeiter</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="shift-types">Schichttypen</TabsTrigger>
              <TabsTrigger value="learning-years">Lehrjahre</TabsTrigger>
              <TabsTrigger value="shift-rules">Schichtregeln</TabsTrigger>
              <TabsTrigger value="planner">Planer</TabsTrigger>
            </TabsList>

            <TabsContent value="employees">
              <Card>
                <CardHeader>
                  <CardTitle>Mitarbeiterverwaltung</CardTitle>
                  <CardDescription>
                    Verwalten Sie Ihre Mitarbeiter, deren Qualifikationen und Verfügbarkeiten.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmployeeManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="teams">
              <Card>
                <CardHeader>
                  <CardTitle>Teamverwaltung</CardTitle>
                  <CardDescription>
                    Organisieren Sie Ihre Mitarbeiter in Teams mit definierten Schichtanteilen.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TeamManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shift-types">
              <Card>
                <CardHeader>
                  <CardTitle>Schichttypdefinition</CardTitle>
                  <CardDescription>
                    Definieren Sie verschiedene Schichttypen mit Arbeitszeiten und Personalbedarfen.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ShiftTypeManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="learning-years">
              <Card>
                <CardHeader>
                  <CardTitle>Lehrjahr-Qualifikationen</CardTitle>
                  <CardDescription>
                    Konfigurieren Sie Qualifikationen und Verfügbarkeiten für verschiedene Lehrjahre.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LearningYearManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shift-rules">
              <Card>
                <CardHeader>
                  <CardTitle>Schichtregeln</CardTitle>
                  <CardDescription>
                    Definieren Sie Regeln für Schichtfolgen und Arbeitsverteilungen.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ShiftRuleManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="planner">
              <Card>
                <CardHeader>
                  <CardTitle>Schichtplanerstellung</CardTitle>
                  <CardDescription>
                    Erstellen und verwalten Sie Schichtpläne für 4-Wochen-Perioden.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ShiftPlanner />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </DataProvider>
  );
}
