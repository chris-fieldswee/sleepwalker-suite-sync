// src/pages/housekeeping/TaskDetails.tsx
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Play, Pause, Square, AlertTriangle } from "lucide-react";
import { useHousekeepingTasks } from "@/hooks/useHousekeepingTasks";
import { useTaskActions } from "@/hooks/useTaskActions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { TaskTimerDisplay, useTaskTimer } from "@/pages/Housekeeping";
import { SecondaryTaskActions } from "@/components/housekeeping/SecondaryTaskActions";
import type { Task } from "@/pages/Housekeeping";

// Utility functions
const getStatusColor = (status: Task['status'] | null | undefined): string => {
    if (!status) return "bg-muted text-muted-foreground";
    const colors: Record<string, string> = {
        todo: "bg-status-todo text-status-todo-foreground",
        in_progress: "bg-status-in-progress text-status-in-progress-foreground",
        paused: "bg-status-paused text-status-paused-foreground",
        done: "bg-status-done text-status-done-foreground",
        repair_needed: "bg-status-repair text-status-repair-foreground",
    };
    return colors[status] || "bg-muted text-muted-foreground";
};

const getStatusLabel = (status: Task['status'] | null | undefined): string => {
    if (!status) return "Nieznany";
    const labels: Record<string, string> = {
        todo: "Do sprzątania", in_progress: "W trakcie", paused: "Wstrzymane",
        done: "Zrobione", repair_needed: "Naprawa",
    };
    return labels[status] || (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '));
};

const getCleaningTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        W: "Wyjazd",
        P: "Przyjazd",
        T: "Transformacja",
        O: "Odśwież",
        G: "Głębokie",
        S: "Serwis"
    };
    return labels[type] || type;
};

export default function TaskDetails() {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const { tasks, loading, activeTaskId, setActiveTaskId, fetchTasks } = useHousekeepingTasks();
    const taskActions = useTaskActions(tasks, setActiveTaskId, activeTaskId, fetchTasks);

    const task = tasks.find(t => t.id === taskId);

    useEffect(() => {
        if (!loading && !task) {
            navigate("/housekeeping");
        }
    }, [loading, task, navigate]);

    // Get timer for the current task
    const elapsedSeconds = useTaskTimer(task || null);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <span className="ml-2">Ładowanie...</span>
            </div>
        );
    }

    if (!task) {
        return null;
    }

    const isActive = activeTaskId === task.id;
    const canStart = (task.status === 'todo' || task.status === 'repair_needed') && !activeTaskId;
    const canPause = task.status === 'in_progress' && isActive;
    const canResume = task.status === 'paused' && !activeTaskId;
    const canStop = (task.status === 'in_progress' || task.status === 'paused') && isActive;

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header with Back and Sign Out */}
            <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate("/housekeeping")}
                        className="h-10 w-10"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span className="sr-only">Wróć</span>
                    </Button>

                    <h1 className="text-lg font-semibold">Szczegóły zadania</h1>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={signOut}
                        className="h-10 w-10"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="sr-only">Wyloguj</span>
                    </Button>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-4 space-y-6">
                {/* Task Info Card */}
                <Card>
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div>
                                <CardTitle className="text-2xl">{task.room.name}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {new Date(task.date).toLocaleDateString('pl-PL', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                            </div>
                            <Badge className={cn(getStatusColor(task.status), "text-white")}>
                                {getStatusLabel(task.status)}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Typ sprzątania</p>
                                <p className="font-medium">{getCleaningTypeLabel(task.cleaning_type)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Liczba gości</p>
                                <p className="font-medium">{task.guest_count}</p>
                            </div>
                            {task.time_limit && (
                                <div>
                                    <p className="text-muted-foreground">Limit czasu</p>
                                    <p className="font-medium">{task.time_limit} minut</p>
                                </div>
                            )}
                        </div>

                        {task.reception_notes && (
                            <div className="pt-4 border-t">
                                <p className="text-sm text-muted-foreground mb-1">Notatki recepcji</p>
                                <p className="text-sm">{task.reception_notes}</p>
                            </div>
                        )}

                        {task.housekeeping_notes && (
                            <div className="pt-4 border-t">
                                <p className="text-sm text-muted-foreground mb-1">Twoja notatka</p>
                                <p className="text-sm italic">{task.housekeeping_notes}</p>
                            </div>
                        )}

                        {task.issue_flag && (
                            <div className="pt-4 border-t">
                                <div className="p-3 rounded-md border border-red-200 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">
                                    <p className="font-semibold flex items-center mb-2">
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        Problem konserwacyjny
                                    </p>
                                    {task.issue_description && <p className="text-sm mb-2">"{task.issue_description}"</p>}
                                    {task.issue_photo && (
                                        <a href={task.issue_photo} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80">
                                            <img src={task.issue_photo} alt="Zdjęcie problemu" className="h-24 w-24 object-cover rounded border" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Timer Display */}
                        {task.start_time && (
                            <div className="pt-4 border-t">
                                <TaskTimerDisplay task={task} />
                            </div>
                        )}

                        {/* Secondary Actions */}
                        <div className="pt-4 border-t flex justify-end">
                            <SecondaryTaskActions
                                task={task}
                                onSaveNote={taskActions.handleSaveNote}
                                onReportIssue={taskActions.handleReportIssue}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Large Action Buttons */}
                <div className="space-y-3">
                    {canStart && (
                        <Button
                            size="lg"
                            className="w-full h-16 text-lg"
                            onClick={() => taskActions.handleStart(task.id)}
                        >
                            <Play className="mr-2 h-6 w-6" />
                            Rozpocznij
                        </Button>
                    )}

                    {canPause && (
                        <Button
                            size="lg"
                            variant="secondary"
                            className="w-full h-16 text-lg"
                            onClick={() => taskActions.handlePause(task.id)}
                        >
                            <Pause className="mr-2 h-6 w-6" />
                            Wstrzymaj
                        </Button>
                    )}

                    {canResume && (
                        <Button
                            size="lg"
                            className="w-full h-16 text-lg"
                            onClick={() => taskActions.handleResume(task.id)}
                        >
                            <Play className="mr-2 h-6 w-6" />
                            Wznów
                        </Button>
                    )}

                    {canStop && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    size="lg"
                                    variant="destructive"
                                    className="w-full h-16 text-lg"
                                >
                                    <Square className="mr-2 h-6 w-6" />
                                    Zakończ
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Czy na pewno zakończyć?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Czy na pewno chcesz zakończyć to zadanie? Ta akcja oznaczy zadanie jako ukończone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => taskActions.handleStop(task.id)}>
                                        Zakończ zadanie
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </main>
        </div>
    );
}
