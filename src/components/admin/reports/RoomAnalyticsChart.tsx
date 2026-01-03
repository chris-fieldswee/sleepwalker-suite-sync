import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import type { TaskReportData, IssueReportData, RoomReportData } from '@/hooks/useAdminReports';

interface RoomAnalyticsChartProps {
  tasks: TaskReportData[];
  issues: IssueReportData[];
  rooms: RoomReportData[];
}

export function RoomAnalyticsChart({ tasks, issues, rooms }: RoomAnalyticsChartProps) {
  // Tasks per room
  const tasksPerRoomData = useMemo(() => {
    const roomTaskCounts: Record<string, number> = {};
    
    tasks.forEach(task => {
      roomTaskCounts[task.room_id] = (roomTaskCounts[task.room_id] || 0) + 1;
    });

    const roomMap = new Map(rooms.map(r => [r.id, r.name]));

    return Object.entries(roomTaskCounts)
      .map(([roomId, count]) => ({
        name: roomMap.get(roomId) || roomId,
        value: count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15); // Top 15 rooms
  }, [tasks, rooms]);

  // Issues per room
  const issuesPerRoomData = useMemo(() => {
    const roomIssueCounts: Record<string, number> = {};
    
    issues.forEach(issue => {
      roomIssueCounts[issue.room_id] = (roomIssueCounts[issue.room_id] || 0) + 1;
    });

    const roomMap = new Map(rooms.map(r => [r.id, r.name]));

    return Object.entries(roomIssueCounts)
      .map(([roomId, count]) => ({
        name: roomMap.get(roomId) || roomId,
        value: count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15); // Top 15 rooms
  }, [issues, rooms]);

  // Room group performance
  const roomGroupData = useMemo(() => {
    const groupStats: Record<string, { tasks: number; issues: number; avgDuration: number; count: number }> = {};
    
    tasks.forEach(task => {
      if (!groupStats[task.room_group]) {
        groupStats[task.room_group] = { tasks: 0, issues: 0, avgDuration: 0, count: 0 };
      }
      groupStats[task.room_group].tasks++;
      if (task.status === 'done' && task.actual_time) {
        groupStats[task.room_group].avgDuration += task.actual_time;
        groupStats[task.room_group].count++;
      }
    });

    issues.forEach(issue => {
      if (!groupStats[issue.room_group]) {
        groupStats[issue.room_group] = { tasks: 0, issues: 0, avgDuration: 0, count: 0 };
      }
      groupStats[issue.room_group].issues++;
    });

    return Object.entries(groupStats).map(([group, stats]) => ({
      name: group,
      zadania: stats.tasks,
      problemy: stats.issues,
      średniCzas: stats.count > 0 ? Math.round(stats.avgDuration / stats.count) : 0,
    }));
  }, [tasks, issues]);

  // Room utilization (tasks per room, grouped)
  const roomUtilizationData = useMemo(() => {
    const utilizationRanges = [
      { name: '0 zadań', min: 0, max: 0, count: 0 },
      { name: '1-5 zadań', min: 1, max: 5, count: 0 },
      { name: '6-10 zadań', min: 6, max: 10, count: 0 },
      { name: '11-20 zadań', min: 11, max: 20, count: 0 },
      { name: '> 20 zadań', min: 21, max: Infinity, count: 0 },
    ];

    const roomTaskCounts: Record<string, number> = {};
    tasks.forEach(task => {
      roomTaskCounts[task.room_id] = (roomTaskCounts[task.room_id] || 0) + 1;
    });

    Object.values(roomTaskCounts).forEach(count => {
      utilizationRanges.forEach(range => {
        if (count >= range.min && count <= range.max) {
          range.count++;
        }
      });
    });

    // Count rooms with 0 tasks
    const roomsWithTasks = new Set(Object.keys(roomTaskCounts));
    utilizationRanges[0].count = rooms.length - roomsWithTasks.size;

    return utilizationRanges.filter(r => r.count > 0);
  }, [tasks, rooms]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Room Group Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Wydajność grup pokoi</CardTitle>
          <CardDescription>Zadania, problemy i średni czas w grupach pokoi</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            zadania: { label: "Zadania", color: "hsl(var(--chart-1))" },
            problemy: { label: "Problemy", color: "hsl(var(--destructive))" },
          }}>
            <BarChart data={roomGroupData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar yAxisId="left" dataKey="zadania" fill="#8884d8" />
              <Bar yAxisId="left" dataKey="problemy" fill="#FF8042" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Room Utilization Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Wykorzystanie pokoi</CardTitle>
          <CardDescription>Rozkład liczby zadań na pokój</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{}}>
            <BarChart data={roomUtilizationData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="#00C49F" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Top Rooms by Tasks */}
      {tasksPerRoomData.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Najwięcej zadań - top 15 pokoi</CardTitle>
            <CardDescription>Pokoje z największą liczbą zadań</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}}>
              <BarChart data={tasksPerRoomData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="#0088FE" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Rooms by Issues */}
      {issuesPerRoomData.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Najwięcej problemów - top 15 pokoi</CardTitle>
            <CardDescription>Pokoje z największą liczbą problemów</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}}>
              <BarChart data={issuesPerRoomData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="#FF8042" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

