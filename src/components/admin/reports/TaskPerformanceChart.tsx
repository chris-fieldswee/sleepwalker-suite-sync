import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import type { TaskReportData } from '@/hooks/useAdminReports';

interface TaskPerformanceChartProps {
  tasks: TaskReportData[];
}

const cleaningTypeLabels: Record<string, string> = {
  W: "Wyjazd",
  P: "Przyjazd",
  T: "Trakt",
  O: "Odświeżenie",
  G: "Generalne",
  S: "Standard",
};

const statusLabels: Record<string, string> = {
  todo: "Do zrobienia",
  in_progress: "W trakcie",
  paused: "Wstrzymane",
  done: "Ukończone",
  repair_needed: "Wymaga naprawy",
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function TaskPerformanceChart({ tasks }: TaskPerformanceChartProps) {
  // Status distribution
  const statusData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    tasks.forEach(task => {
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      status,
    }));
  }, [tasks]);

  // Cleaning type distribution
  const cleaningTypeData = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    tasks.forEach(task => {
      typeCounts[task.cleaning_type] = (typeCounts[task.cleaning_type] || 0) + 1;
    });
    return Object.entries(typeCounts).map(([type, count]) => ({
      name: cleaningTypeLabels[type] || type,
      value: count,
      type,
    }));
  }, [tasks]);

  // Room group distribution
  const roomGroupData = useMemo(() => {
    const groupCounts: Record<string, number> = {};
    tasks.forEach(task => {
      groupCounts[task.room_group] = (groupCounts[task.room_group] || 0) + 1;
    });
    return Object.entries(groupCounts)
      .map(([group, count]) => ({ name: group, value: count }))
      .sort((a, b) => b.value - a.value);
  }, [tasks]);

  // Time efficiency data (actual vs limit)
  const timeEfficiencyData = useMemo(() => {
    const completedTasks = tasks.filter(
      t => t.status === 'done' && t.actual_time && t.time_limit
    );
    
    if (completedTasks.length === 0) return [];

    const efficiencyRanges = [
      { name: 'Przed czasem', range: [-Infinity, -10], count: 0 },
      { name: 'W czasie (-10min)', range: [-10, 0], count: 0 },
      { name: 'Przekroczony (0-30min)', range: [0, 30], count: 0 },
      { name: 'Znacznie przekroczony (30+)', range: [30, Infinity], count: 0 },
    ];

    completedTasks.forEach(task => {
      const diff = (task.difference || 0);
      efficiencyRanges.forEach(range => {
        if (diff >= range.range[0] && diff < range.range[1]) {
          range.count++;
        }
      });
    });

    return efficiencyRanges.filter(r => r.count > 0);
  }, [tasks]);

  // Daily task volume
  const dailyVolumeData = useMemo(() => {
    const volumeMap: Record<string, { created: number; completed: number }> = {};
    
    tasks.forEach(task => {
      if (!volumeMap[task.date]) {
        volumeMap[task.date] = { created: 0, completed: 0 };
      }
      volumeMap[task.date].created++;
      if (task.status === 'done') {
        volumeMap[task.date].completed++;
      }
    });

    return Object.entries(volumeMap)
      .map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
        utworzone: counts.created,
        ukończone: counts.completed,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 14 days
  }, [tasks]);

  const statusChartConfig = {
    todo: { label: "Do zrobienia", color: "hsl(var(--muted-foreground))" },
    in_progress: { label: "W trakcie", color: "hsl(var(--chart-2))" },
    paused: { label: "Wstrzymane", color: "hsl(var(--chart-3))" },
    done: { label: "Ukończone", color: "hsl(var(--chart-1))" },
    repair_needed: { label: "Wymaga naprawy", color: "hsl(var(--destructive))" },
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Status Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Rozkład statusów zadań</CardTitle>
          <CardDescription>Podział zadań według statusu</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={statusChartConfig}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Cleaning Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Rozkład typów sprzątania</CardTitle>
          <CardDescription>Podział zadań według typu sprzątania</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}}>
            <BarChart data={cleaningTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Room Group Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Zadania według grup pokoi</CardTitle>
          <CardDescription>Liczba zadań w każdej grupie pokoi</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}}>
            <BarChart data={roomGroupData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="#00C49F" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Time Efficiency */}
      {timeEfficiencyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Efektywność czasowa</CardTitle>
            <CardDescription>Różnica między czasem rzeczywistym a limitem</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}}>
              <BarChart data={timeEfficiencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#FF8042" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Task Volume */}
      {dailyVolumeData.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Dzienna ilość zadań</CardTitle>
            <CardDescription>Liczba utworzonych i ukończonych zadań (ostatnie 14 dni)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              utworzone: { label: "Utworzone", color: "hsl(var(--chart-2))" },
              ukończone: { label: "Ukończone", color: "hsl(var(--chart-1))" },
            }}>
              <BarChart data={dailyVolumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="utworzone" fill="#8884d8" />
                <Bar dataKey="ukończone" fill="#00C49F" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


