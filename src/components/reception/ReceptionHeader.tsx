// src/components/reception/ReceptionHeader.tsx
import { Button } from "@/components/ui/button";
import { LogOut, RefreshCw } from "lucide-react";
import type { AddTaskDialog } from './AddTaskDialog'; // Import type for trigger prop
import type { WorkLogDialog } from './WorkLogDialog'; // Import type for trigger prop

interface ReceptionHeaderProps {
    onRefresh: () => void;
    onSignOut: () => void;
    refreshing: boolean;
    loading: boolean;
    // We pass the dialog components as props to keep trigger logic separate
    addTaskTrigger?: React.ReactNode;
    workLogTrigger?: React.ReactNode;
}

export function ReceptionHeader({
    onRefresh,
    onSignOut,
    refreshing,
    loading,
    addTaskTrigger,
    workLogTrigger
}: ReceptionHeaderProps) {
    return (
        <header className="border-b bg-card sticky top-0 z-20 shadow-sm">
            <div className="container mx-auto flex items-center justify-between px-4 py-4">
                <div>
                    <h1 className="text-2xl font-bold">Reception Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                        Housekeeping Operations Management
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing || loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} /> Refresh
                    </Button>

                    {/* Render triggers passed as props */}
                    {workLogTrigger}
                    {addTaskTrigger}

                    <Button variant="outline" size="sm" onClick={onSignOut}>
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out
                    </Button>
                </div>
            </div>
        </header>
    );
}
