import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import type { TaskReportData, WorkLogReportData } from '@/hooks/useAdminReports';

interface StaffPerformanceChartProps {
  tasks: TaskReportData[];
  workLogs: WorkLogReportData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82CA9D'];

export function StaffPerformanceChart({ tasks, workLogs }: StaffPerformanceChartProps) {
  // Staff productivity (tasks completed)
  const staffProductivityData = useMemo(() => {
    const staffTaskCounts: Record<string, { name: string; tasks: number; completed: number }> = {};
    
    tasks.forEach(task => {
      if (task.user_id && task.user_name) {
        if (!staffTaskCounts[task.user_id]) {
          staffTaskCounts[task.user_id] = {
            name: task.user_name,
            tasks: 0,
            completed: 0,
          };
        }
        staffTaskCounts[task.user_id].tasks++;
        if (task.status === 'done') {
          staffTaskCounts[task.user_id].completed++;
        }
      }
    });

    return Object.values(staffTaskCounts)
      .map(staff => ({
        name: staff.name,
        zadania: staff.tasks,
        ukończone: staff.completed,
      }))
      .sort((a, b) => b.ukończone - a.ukończone)
      .slice(0, 10); // Top 10
  }, [tasks]);

  // Hours worked by staff
  const hoursWorkedData = useMemo(() => {
    const staffHours: Record<string, { name: string; hours: number; breakHours: number }> = {};
    
    workLogs.forEach(log => {
      if (!staffHours[log.user_id]) {
        staffHours[log.user_id] = {
          name: log.user_name,
          hours: 0,
          breakHours: 0,
        };
      }
      staffHours[log.user_id].hours += (log.total_minutes || 0) / 60;
      staffHours[log.user_id].breakHours += 
        ((log.break_minutes || 0) + (log.breakfast_minutes || 0) + (log.laundry_minutes || 0)) / 60;
    });

    return Object.values(staffHours)
      .map(staff => ({
        name: staff.name,
        godziny: Math.round(staff.hours * 10) / 10,
        przerwy: Math.round(staff.breakHours * 10) / 10,
      }))
      .sort((a, b) => b.godziny - a.godziny)
      .slice(0, 10); // Top 10
  }, [workLogs]);

  // Tasks per hour (efficiency)
  const efficiencyData = useMemo(() => {
    const staffEfficiency: Record<string, { name: string; tasks: number; hours: number }> = {};
    
    // Count tasks per staff
    tasks.forEach(task => {
      if (task.user_id && task.user_name && task.status === 'done') {
        if (!staffEfficiency[task.user_id]) {
          staffEfficiency[task.user_id] = {
            name: task.user_name,
            tasks: 0,
            hours: 0,
          };
        }
        staffEfficiency[task.user_id].tasks++;
      }
    });

    // Add hours from work logs
    workLogs.forEach(log => {
      if (staffEfficiency[log.user_id]) {
        staffEfficiency[log.user_id].hours += (log.total_minutes || 0) / 60;
      }
    });

    return Object.values(staffEfficiency)
      .filter(staff => staff.hours > 0)
      .map(staff => ({
        name: staff.name,
        efektywność: Math.round((staff.tasks / staff.hours) * 100) / 100,
      }))
      .sort((a, b) => b.efektywność - a.efektywność)
      .slice(0, 10); // Top 10
  }, [tasks, workLogs]);

  // Break time breakdown
  const breakTimeData = useMemo(() => {
    const totalBreak = workLogs.reduce((sum, log) => sum + (log.break_minutes || 0), 0);
    const totalBreakfast = workLogs.reduce((sum, log) => sum + (log.breakfast_minutes || 0), 0);
    const totalLaundry = workLogs.reduce((sum, log) => sum + (log.laundry_minutes || 0), 0);

    return [
      { name: 'Przerwy', value: Math.round(totalBreak / 60 * 10) / 10 },
      { name: 'Śniadania', value: Math.round(totalBreakfast / 60 * 10) / 10 },
      { name: 'Pranie', value: Math.round(totalLaundry / 60 * 10) / 10 },
    ].filter(item => item.value > 0);
  }, [workLogs]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Staff Productivity */}
      <Card>
        <CardHeader>
          <CardTitle>Produktywność personelu</CardTitle>
          <CardDescription>Liczba zadań i ukończonych zadań na personel</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            zadania: { label: "Zadania", color: "hsl(var(--chart-2))" },
            ukończone: { label: "Ukończone", color: "hsl(var(--chart-1))" },
          }}>
            <BarChart data={staffProductivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar dataKey="zadania" fill="#8884d8" />
              <Bar dataKey="ukończone" fill="#00C49F" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Hours Worked */}
      <Card>
        <CardHeader>
          <CardTitle>Godziny pracy</CardTitle>
          <CardDescription>Łączne godziny pracy i przerwy</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            godziny: { label: "Godziny pracy", color: "hsl(var(--chart-1))" },
            przerwy: { label: "Przerwy", color: "hsl(var(--chart-2))" },
          }}>
            <BarChart data={hoursWorkedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar dataKey="godziny" fill="#0088FE" />
              <Bar dataKey="przerwy" fill="#FFBB28" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Efficiency (Tasks per hour) */}
      {efficiencyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Efektywność personelu</CardTitle>
            <CardDescription>Liczba ukończonych zadań na godzinę pracy</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}}>
              <BarChart data={efficiencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="efektywność" fill="#00C49F" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Break Time Breakdown */}
      {breakTimeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rozkład czasu przerw</CardTitle>
            <CardDescription>Podział czasu przerw, śniadań i prania</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}}>
              <PieChart>
                <Pie
                  data={breakTimeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {breakTimeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

