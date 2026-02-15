// src/components/reception/TaskSummaryFooter.tsx
import { Clock, Timer, TrendingUp } from "lucide-react";
import { cn, formatMinutesAsHm, formatDifferenceAsHm } from "@/lib/utils";

interface TaskSummaryFooterProps {
  totalLimit: number | null;
  totalActual: number | null;
  totalDifference: number | null;
  visibleTaskCount: number;
  showActual?: boolean;
  showDifference?: boolean;
}

export function TaskSummaryFooter({ totalLimit, totalActual, totalDifference, visibleTaskCount, showActual = true, showDifference = false }: TaskSummaryFooterProps) {
  if (visibleTaskCount === 0) {
    return null;
  }

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-5 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-14 items-center justify-end gap-6 px-4 md:px-6 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Całkowity Limit:</span>
          <span className="font-medium">{formatMinutesAsHm(totalLimit)}</span>
        </div>
        {showActual && (
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Całkowity Czas:</span>
            <span
              className={cn(
                "font-medium",
                totalLimit !== null && totalActual !== null && totalActual > totalLimit
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              )}
            >
              {formatMinutesAsHm(totalActual)}
            </span>
          </div>
        )}
        {showDifference && (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Całkowita Różnica:</span>
            <span
              className={cn(
                "font-medium",
                totalDifference !== null && totalDifference > 0
                  ? "text-red-600 dark:text-red-400"
                  : totalDifference !== null && totalDifference < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground"
              )}
            >
              {formatDifferenceAsHm(totalDifference)}
            </span>
          </div>
        )}
      </div>
    </footer>
  );
}
