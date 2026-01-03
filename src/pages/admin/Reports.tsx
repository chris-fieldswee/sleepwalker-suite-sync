import { useState } from 'react';
import { TimeRangeSelector } from '@/components/admin/reports/TimeRangeSelector';
import type { DateRange } from '@/hooks/useAdminReports';
import { MetricsCards } from '@/components/admin/reports/MetricsCards';
import { TaskPerformanceChart } from '@/components/admin/reports/TaskPerformanceChart';
import { IssueMetricsChart } from '@/components/admin/reports/IssueMetricsChart';
import { StaffPerformanceChart } from '@/components/admin/reports/StaffPerformanceChart';
import { RoomAnalyticsChart } from '@/components/admin/reports/RoomAnalyticsChart';
import { useAdminReports } from '@/hooks/useAdminReports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from 'lucide-react';

export default function Reports() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: today,
    to: today,
  });

  const { tasks, issues, workLogs, rooms, loading, error } = useAdminReports(dateRange);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Raporty</h1>
        <p className="text-muted-foreground mt-1">
          Analiza wydajności i statystyki operacji
        </p>
      </div>

      {/* Time Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Zakres dat</CardTitle>
          <CardDescription>Wybierz okres do analizy</CardDescription>
        </CardHeader>
        <CardContent>
          <TimeRangeSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Błąd</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Metrics Cards */}
          <MetricsCards tasks={tasks} issues={issues} workLogs={workLogs} />

          {/* Task Performance Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Wydajność zadań</h2>
              <p className="text-muted-foreground">
                Analiza wykonania zadań sprzątania
              </p>
            </div>
            <TaskPerformanceChart tasks={tasks} />
          </div>

          {/* Issue Metrics Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Zarządzanie problemami</h2>
              <p className="text-muted-foreground">
                Analiza zgłoszonych i rozwiązanych problemów
              </p>
            </div>
            <IssueMetricsChart issues={issues} />
          </div>

          {/* Staff Performance Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Wydajność personelu</h2>
              <p className="text-muted-foreground">
                Analiza pracy i produktywności personelu
              </p>
            </div>
            <StaffPerformanceChart tasks={tasks} workLogs={workLogs} />
          </div>

          {/* Room Analytics Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Analiza pokoi</h2>
              <p className="text-muted-foreground">
                Wykorzystanie i problemy związane z pokojami
              </p>
            </div>
            <RoomAnalyticsChart tasks={tasks} issues={issues} rooms={rooms} />
          </div>
        </>
      )}
    </div>
  );
}

