// src/pages/reception/Dashboard.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, AlertTriangle, TrendingUp, Plus, UserPlus, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { StatsCards } from "@/components/reception/StatsCards";
import { AddTaskDialog } from "@/components/reception/AddTaskDialog";
// *** Import the new dialog ***
import { ReportNewIssueDialog } from "@/components/reception/ReportNewIssueDialog";
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
  // *** Add props for ReportNewIssueDialog ***
  handleReportNewIssue: (roomId: string, description: string, photo: File | null) => Promise<boolean>;
  isSubmittingNewIssue: boolean;
  // Base path for navigation links (defaults to /reception)
  basePath?: string;
}

export default function Dashboard({
  stats,
  availableRooms,
  allStaff,
  initialNewTaskState,
  handleAddTask,
  isSubmittingTask,
  // *** Destructure new props ***
  handleReportNewIssue,
  isSubmittingNewIssue,
  basePath = "/reception"
}: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* ... Header, StatsCards, Navigation Links Grid remain the same ... */}
      <div>
        <h1 className="text-3xl font-bold">{basePath === "/admin" ? "Panel administratora" : "Panel recepcji"}</h1>
        <p className="text-muted-foreground mt-1">
          Przegląd operacji sprzątania
        </p>
      </div>
      <StatsCards stats={stats} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ... Links Cards ... */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link to={`${basePath}/tasks`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Aktywne zadania
              </CardTitle>
              <CardDescription>
                Przeglądaj i zarządzaj bieżącymi zadaniami sprzątania
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.inProgress} w trakcie
              </p>
              <Button className="mt-4 w-full" variant="outline">
                Przejdź do zadań
              </Button>
            </CardContent>
          </Link>
        </Card>
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <Link to={`${basePath}/issues`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Problemy
              </CardTitle>
              <CardDescription>
                Śledź i rozwiązuj zgłoszone problemy konserwacyjne
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.repair}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Wymagają uwagi
              </p>
              <Button className="mt-4 w-full" variant="outline">
                Zobacz problemy
              </Button>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Szybkie akcje
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AddTaskDialog
            availableRooms={availableRooms}
            allStaff={allStaff}
            initialState={initialNewTaskState}
            onSubmit={handleAddTask}
            isSubmitting={isSubmittingTask}
            triggerButton={
              <Button variant="outline" className="h-20 w-full flex-col gap-1">
                <Plus className="h-5 w-5 mb-1" />
                <span>Dodaj zadanie</span>
              </Button>
            }
          />
          <Button variant="outline" className="h-20 w-full flex-col gap-1" asChild>
            <Link to={`${basePath}/users`}>
              <UserPlus className="h-5 w-5 mb-1" />
              <span>Dodaj użytkownika</span>
            </Link>
          </Button>

          {/* *** Replace Report Issue Link with Dialog Trigger *** */}
          <ReportNewIssueDialog
            availableRooms={availableRooms}
            onSubmit={handleReportNewIssue}
            isSubmitting={isSubmittingNewIssue}
            triggerButton={
              <Button variant="outline" className="h-20 w-full flex-col gap-1">
                <AlertTriangle className="h-5 w-5 mb-1 text-destructive" />
                <span className="text-destructive">Zgłoś problem</span>
              </Button>
            }
          />
          {/* --- End Replacement --- */}

          <Button variant="outline" className="h-20 w-full flex-col gap-1" asChild>
            <Link to={`${basePath}/availability`}>
              <Calendar className="h-5 w-5 mb-1" />
              <span>Dodaj dostępność</span>
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
