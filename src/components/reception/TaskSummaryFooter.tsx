// src/components/reception/TaskSummaryFooter.tsx
import { Clock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskSummaryFooterProps {
  totalLimit: number | null;
  totalActual: number | null;
  visibleTaskCount: number;
}

export function TaskSummaryFooter({ totalLimit, totalActual, visibleTaskCount }: TaskSummaryFooterProps) {
  // Only render if there are visible tasks
  if (visibleTaskCount === 0) {
    return null;
  }

  const formatMinutes = (minutes: number | null): string => {
    if (minutes === null || minutes < 0) return "-";
    return `${minutes} min`;
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-14 items-center justify-end gap-6 px-4 md:px-6 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Total Limit:</span>
          <span className="font-medium">{formatMinutes(totalLimit)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Total Actual:</span>
          <span
            className={cn(
              "font-medium",
              totalLimit !== null && totalActual !== null && totalActual > totalLimit
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            )}
          >
            {formatMinutes(totalActual)}
          </span>
        </div>
      </div>
    </footer>
  );
}
