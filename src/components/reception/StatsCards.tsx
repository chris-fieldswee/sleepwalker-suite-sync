// src/components/reception/StatsCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatsCardsProps {
    stats: {
        total: number;
        todo: number;
        inProgress: number;
        done: number;
        repair: number;
    };
}

export function StatsCards({ stats }: StatsCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
            <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">To Clean</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-status-todo">{stats.todo}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-status-in-progress">{stats.inProgress}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-status-done">{stats.done}</div></CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Issues</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-status-repair">{stats.repair}</div></CardContent>
            </Card>
        </div>
    );
}
