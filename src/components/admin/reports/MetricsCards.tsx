import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock, AlertTriangle, Users, TrendingUp, Target } from 'lucide-react';
import type { TaskReportData, IssueReportData, WorkLogReportData } from '@/hooks/useAdminReports';

interface MetricsCardsProps {
  tasks: TaskReportData[];
  issues: IssueReportData[];
  workLogs: WorkLogReportData[];
}

export function MetricsCards({ tasks, issues, workLogs }: MetricsCardsProps) {
  const metrics = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const unresolvedIssues = issues.filter(i => i.status !== 'resolved' && i.status !== 'closed').length;
    const totalIssues = issues.length;

    const totalHoursWorked = workLogs.reduce((sum, log) => {
      return sum + (log.total_minutes || 0) / 60;
    }, 0);
    const totalHoursRounded = Math.round(totalHoursWorked * 10) / 10;

    const completedTasksWithTime = tasks.filter(t => t.status === 'done' && t.actual_time && t.time_limit);
    const onTimeTasks = completedTasksWithTime.filter(t => (t.actual_time || 0) <= (t.time_limit || 0)).length;
    const onTimeRate = completedTasksWithTime.length > 0
      ? Math.round((onTimeTasks / completedTasksWithTime.length) * 100)
      : 0;

    const averageTaskDuration = completedTasksWithTime.length > 0
      ? Math.round(
          completedTasksWithTime.reduce((sum, t) => sum + (t.actual_time || 0), 0) /
          completedTasksWithTime.length
        )
      : 0;

    return {
      totalTasks,
      completedTasks,
      completionRate,
      unresolvedIssues,
      totalIssues,
      totalHoursRounded,
      onTimeRate,
      averageTaskDuration,
    };
  }, [tasks, issues, workLogs]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            Wszystkie zadania
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalTasks}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.completedTasks} ukończone
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Wskaźnik ukończenia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.completionRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.completedTasks} z {metrics.totalTasks}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Otwarte usterki
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.unresolvedIssues}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {metrics.totalIssues} łącznie
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" />
            Godziny pracy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalHoursRounded}h</div>
          <p className="text-xs text-muted-foreground mt-1">
            {workLogs.length} wpisów
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Średni czas zadania
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.averageTaskDuration} min</div>
          <p className="text-xs text-muted-foreground mt-1">
            Dla ukończonych zadań
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Terminowość
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.onTimeRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            W terminie
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

