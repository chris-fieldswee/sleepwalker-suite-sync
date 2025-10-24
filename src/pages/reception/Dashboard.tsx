import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Archive, AlertTriangle, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { StatsCards } from "@/components/reception/StatsCards";

interface DashboardProps {
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    repair: number;
  };
}

export default function Dashboard({ stats }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reception Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Housekeeping Operations Overview
        </p>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link to="/reception/tasks">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Active Tasks
              </CardTitle>
              <CardDescription>
                View and manage ongoing housekeeping tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.inProgress} in progress
              </p>
              <Button className="mt-4 w-full" variant="outline">
                Go to Tasks
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link to="/reception/archive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Archived Tasks
              </CardTitle>
              <CardDescription>
                Review completed tasks and performance history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.done}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Completed today
              </p>
              <Button className="mt-4 w-full" variant="outline">
                View Archive
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link to="/reception/issues">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Issues
              </CardTitle>
              <CardDescription>
                Track and resolve reported maintenance issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.repair}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Require attention
              </p>
              <Button className="mt-4 w-full" variant="outline">
                View Issues
              </Button>
            </CardContent>
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-20" asChild>
            <Link to="/reception/tasks">Add Task</Link>
          </Button>
          <Button variant="outline" className="h-20" asChild>
            <Link to="/reception/tasks">Work Log</Link>
          </Button>
          <Button variant="outline" className="h-20" asChild>
            <Link to="/reception/issues">Report Issue</Link>
          </Button>
          <Button variant="outline" className="h-20" asChild>
            <Link to="/reception/archive">View Reports</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
