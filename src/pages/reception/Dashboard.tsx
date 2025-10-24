// src/pages/reception/Dashboard.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Archive, AlertTriangle, TrendingUp, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { StatsCards } from "@/components/reception/StatsCards";
import { AddTaskDialog } from "@/components/reception/AddTaskDialog";
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
      {/* ... (rest of the dashboard header and cards remain the same) ... */}

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* *** Pass the fully formed Button with children as triggerButton *** */}
          <AddTaskDialog
            availableRooms={availableRooms}
            allStaff={allStaff}
            initialState={initialNewTaskState}
            onSubmit={handleAddTask}
            isSubmitting={isSubmittingTask}
            triggerButton={
              // Pass the Button component with its children directly
              <Button variant="outline" className="h-20 w-full flex-col gap-1">
                 <Plus className="h-5 w-5 mb-1" />
                 <span>Add Task</span>
              </Button>
            }
          />
          {/* Other buttons remain the same */}
          <Button variant="outline" className="h-20 w-full flex-col gap-1" asChild>
            <Link to="/reception/tasks">Work Log</Link>
          </Button>
          <Button variant="outline" className="h-20 w-full flex-col gap-1" asChild>
            <Link to="/reception/issues">Report Issue</Link>
          </Button>
          <Button variant="outline" className="h-20 w-full flex-col gap-1" asChild>
            <Link to="/reception/archive">View Reports</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
