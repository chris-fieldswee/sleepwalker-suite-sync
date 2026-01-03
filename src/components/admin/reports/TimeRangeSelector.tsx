import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/hooks/useAdminReports";

export type TimeRangePreset = "today" | "thisWeek" | "thisMonth" | "last30Days" | "custom";

interface TimeRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const presetLabels: Record<TimeRangePreset, string> = {
  today: "Dzisiaj",
  thisWeek: "Ten tydzień",
  thisMonth: "Ten miesiąc",
  last30Days: "Ostatnie 30 dni",
  custom: "Własny zakres",
};

export function TimeRangeSelector({ dateRange, onDateRangeChange }: TimeRangeSelectorProps) {
  const [preset, setPreset] = useState<TimeRangePreset>("today");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const getPresetRange = (presetType: TimeRangePreset): DateRange => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (presetType) {
      case "today": {
        return { from: today, to: today };
      }
      case "thisWeek": {
        const startOfWeek = new Date(today);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
        startOfWeek.setDate(diff);
        return { from: startOfWeek, to: today };
      }
      case "thisMonth": {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return { from: startOfMonth, to: today };
      }
      case "last30Days": {
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 29); // 30 days including today
        return { from: startDate, to: today };
      }
      case "custom":
        return dateRange;
      default:
        return { from: today, to: today };
    }
  };

  const handlePresetChange = (newPreset: TimeRangePreset) => {
    setPreset(newPreset);
    if (newPreset !== "custom") {
      const range = getPresetRange(newPreset);
      onDateRangeChange(range);
      setCalendarOpen(false);
    } else {
      setCalendarOpen(true);
    }
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onDateRangeChange({ from: range.from, to: range.to });
      setPreset("custom");
      setCalendarOpen(false);
    } else if (range?.from) {
      // Single date selected, set both from and to
      onDateRangeChange({ from: range.from, to: range.from });
      setPreset("custom");
    }
  };

  const formatDateRange = (range: DateRange): string => {
    if (range.from.getTime() === range.to.getTime()) {
      return format(range.from, "d MMM yyyy", { locale: pl });
    }
    return `${format(range.from, "d MMM", { locale: pl })} - ${format(range.to, "d MMM yyyy", { locale: pl })}`;
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={preset} onValueChange={(value) => handlePresetChange(value as TimeRangePreset)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(presetLabels).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[280px] justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange ? formatDateRange(dateRange) : "Wybierz daty"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={dateRange}
            onSelect={handleCalendarSelect as any}
            numberOfMonths={2}
            locale={pl}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

