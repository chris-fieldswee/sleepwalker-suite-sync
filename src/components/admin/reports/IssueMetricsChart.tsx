import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { cn } from "@/lib/utils";
import type { IssueReportData } from '@/hooks/useAdminReports';

interface IssueMetricsChartProps {
  issues: IssueReportData[];
}

type IssueStatus = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed' | 'reported';

const priorityLabels: Record<string, string> = {
  low: "Niski",
  medium: "Średni",
  high: "Wysoki",
  urgent: "Pilny",
};

const statusLabels: Record<string, string> = {
  open: "Otwarte",
  in_progress: "W trakcie",
  resolved: "Rozwiązane",
  closed: "Zamknięte",
  reported: "Zgłoszone",
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const statusFilterOptions: Array<{ value: IssueStatus; label: string }> = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'open', label: 'Otwarte' },
  { value: 'in_progress', label: 'W trakcie' },
  { value: 'resolved', label: 'Rozwiązane' },
  { value: 'closed', label: 'Zamknięte' },
  { value: 'reported', label: 'Zgłoszone' },
];

export function IssueMetricsChart({ issues }: IssueMetricsChartProps) {
  const [statusFilter, setStatusFilter] = useState<IssueStatus>('reported');

  // Filter issues by status
  const filteredIssues = useMemo(() => {
    if (statusFilter === 'all') {
      return issues;
    }
    return issues.filter(issue => issue.status === statusFilter);
  }, [issues, statusFilter]);

  // Priority distribution
  const priorityData = useMemo(() => {
    const priorityCounts: Record<string, number> = {};
    filteredIssues.forEach(issue => {
      priorityCounts[issue.priority] = (priorityCounts[issue.priority] || 0) + 1;
    });
    return Object.entries(priorityCounts).map(([priority, count]) => ({
      name: priorityLabels[priority] || priority,
      value: count,
      priority,
    }));
  }, [filteredIssues]);

  // Status distribution
  const statusData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    filteredIssues.forEach(issue => {
      statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1;
    });
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      status,
    }));
  }, [filteredIssues]);

  // Room group distribution
  const roomGroupData = useMemo(() => {
    const groupCounts: Record<string, number> = {};
    filteredIssues.forEach(issue => {
      groupCounts[issue.room_group] = (groupCounts[issue.room_group] || 0) + 1;
    });
    return Object.entries(groupCounts)
      .map(([group, count]) => ({ name: group, value: count }))
      .sort((a, b) => b.value - a.value);
  }, [filteredIssues]);

  // Resolution time data
  const resolutionTimeData = useMemo(() => {
    const resolvedIssues = filteredIssues.filter(i => i.resolved_at && i.reported_at);
    
    if (resolvedIssues.length === 0) return [];

    const resolutionTimes = resolvedIssues.map(issue => {
      const reported = new Date(issue.reported_at);
      const resolved = new Date(issue.resolved_at!);
      const hours = (resolved.getTime() - reported.getTime()) / (1000 * 60 * 60);
      return { hours, priority: issue.priority };
    });

    const ranges = [
      { name: '< 1h', max: 1, count: 0 },
      { name: '1-4h', min: 1, max: 4, count: 0 },
      { name: '4-24h', min: 4, max: 24, count: 0 },
      { name: '1-3 dni', min: 24, max: 72, count: 0 },
      { name: '> 3 dni', min: 72, count: 0 },
    ];

    resolutionTimes.forEach(({ hours }) => {
      ranges.forEach(range => {
        if (range.min !== undefined && range.max !== undefined) {
          if (hours >= range.min && hours < range.max) range.count++;
        } else if (range.max !== undefined) {
          if (hours < range.max) range.count++;
        } else if (range.min !== undefined) {
          if (hours >= range.min) range.count++;
        }
      });
    });

    return ranges.filter(r => r.count > 0);
  }, [filteredIssues]);

  // Daily issue trends
  const dailyIssueData = useMemo(() => {
    const issueMap: Record<string, { reported: number; resolved: number }> = {};
    
    filteredIssues.forEach(issue => {
      const date = issue.reported_at.split('T')[0];
      if (!issueMap[date]) {
        issueMap[date] = { reported: 0, resolved: 0 };
      }
      issueMap[date].reported++;
      if (issue.resolved_at) {
        const resolvedDate = issue.resolved_at.split('T')[0];
        if (!issueMap[resolvedDate]) {
          issueMap[resolvedDate] = { reported: 0, resolved: 0 };
        }
        issueMap[resolvedDate].resolved++;
      }
    });

    return Object.entries(issueMap)
      .map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }),
        zgłoszone: counts.reported,
        rozwiązane: counts.resolved,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 14 days
  }, [filteredIssues]);

  const priorityChartConfig = {
    low: { label: "Niski", color: "hsl(var(--chart-1))" },
    medium: { label: "Średni", color: "hsl(var(--chart-2))" },
    high: { label: "Wysoki", color: "hsl(var(--chart-3))" },
    urgent: { label: "Pilny", color: "hsl(var(--destructive))" },
  };

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filtrowanie problemów</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as IssueStatus)}>
              <SelectTrigger 
                id="status-filter" 
                className={cn(
                  "bg-card h-9 text-sm w-[200px]",
                  statusFilter !== 'all' && "border-[#7d212b]"
                )}
              >
                <SelectValue placeholder="Filtruj status..." />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                {statusFilterOptions.map(option => (
                  <SelectItem key={option.value} value={option.value} className="text-sm">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
      {/* Priority Distribution Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Rozkład priorytetów problemów</CardTitle>
          <CardDescription>Podział problemów według priorytetu</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={priorityChartConfig}>
            <PieChart>
              <Pie
                data={priorityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {priorityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Rozkład statusów problemów</CardTitle>
          <CardDescription>Podział problemów według statusu</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}}>
            <BarChart data={statusData}>
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
          <CardTitle>Problemy według grup pokoi</CardTitle>
          <CardDescription>Liczba problemów w każdej grupie pokoi</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}}>
            <BarChart data={roomGroupData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="#FF8042" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Resolution Time */}
      {resolutionTimeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Czas rozwiązania problemów</CardTitle>
            <CardDescription>Rozkład czasu rozwiązania problemów</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}}>
              <BarChart data={resolutionTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="#00C49F" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Daily Issue Trends */}
      {dailyIssueData.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Trendy dzienne problemów</CardTitle>
            <CardDescription>Liczba zgłoszonych i rozwiązanych problemów (ostatnie 14 dni)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{
              zgłoszone: { label: "Zgłoszone", color: "hsl(var(--chart-2))" },
              rozwiązane: { label: "Rozwiązane", color: "hsl(var(--chart-1))" },
            }}>
              <BarChart data={dailyIssueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="zgłoszone" fill="#FF8042" />
                <Bar dataKey="rozwiązane" fill="#00C49F" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}

