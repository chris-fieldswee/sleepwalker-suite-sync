// src/pages/reception/Dashboard.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Archive, AlertTriangle, TrendingUp, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { StatsCards } from "@/components/reception/StatsCards";
// *** Import AddTaskDialog ***
import { AddTaskDialog } from "@/components/reception/AddTaskDialog";
// *** Import necessary types ***
import type { Room, Staff } from "@/hooks/useReceptionData";
import type { NewTaskState } from "@/hooks/useReceptionActions";

interface DashboardProps {
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    repair: number;
  };
  // *** Add props for AddTaskDialog ***
  availableRooms: Room[];
  allStaff: Staff[];
  initialNewTaskState: NewTaskState;
  handleAddTask: (task: NewTaskState) => Promise<boolean>;
  isSubmittingTask: boolean;
}

export default function Dashboard({
  stats,
  availableRooms,
  allStaff,
  initialNewTaskState,
  handleAddTask,
  isSubmittingTask
}: DashboardProps) {
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
         {/* Active Tasks Card - Link unchanged */}
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

        {/* Archived Tasks Card - Link unchanged */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
           <Link to="/reception/archive">
             {/* ... content unchanged ... */}
              <Button className="mt-4 w-full" variant="outline">
                View Archive
              </Button>
           </Link>
        </Card>

        {/* Issues Card - Link unchanged */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
           <Link to="/reception/issues">
            {/* ... content unchanged ... */}
              <Button className="mt-4 w-full" variant="outline">
                View Issues
              </Button>
           </Link>
        </Card>
      </div>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* *** Wrap Add Task Button with AddTaskDialog *** */}
          <AddTaskDialog
            availableRooms={availableRooms}
            allStaff={allStaff}
            initialState={initialNewTaskState}
            onSubmit={handleAddTask}
            isSubmitting={isSubmittingTask}
            triggerButton={
              <Button variant="outline" className="h-20 w-full flex-col gap-1">
                 <Plus className="h-5 w-5 mb-1" />
                 <span>Add Task</span>
              </Button>
            }
          />
          {/* Work Log Button - Keep as Link for now, or implement modal similarly */}
          <Button variant="outline" className="h-20 w-full flex-col gap-1" asChild>
            <Link to="/reception/tasks">Work Log</Link> {/* TODO: Consider making this a modal too */}
          </Button>
          {/* Report Issue Button - Keep as Link */}
          <Button variant="outline" className="h-20 w-full flex-col gap-1" asChild>
            <Link to="/reception/issues">Report Issue</Link>
          </Button>
          {/* View Reports Button - Keep as Link */}
          <Button variant="outline" className="h-20 w-full flex-col gap-1" asChild>
            <Link to="/reception/archive">View Reports</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
