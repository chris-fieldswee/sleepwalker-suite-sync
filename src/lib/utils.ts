// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format minutes as "45m" or "1h 30m" */
export function formatMinutesAsHm(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format difference in minutes as "+45m" or "-1h 30m" */
export function formatDifferenceAsHm(minutes: number | null): string {
  if (minutes === null) return "-";
  const sign = minutes >= 0 ? "+" : "-";
  return sign + formatMinutesAsHm(Math.abs(minutes));
}

// Helper to format time from TIMESTAMPTZ for input type="time"
export const formatTimeForInput = (dateTimeString: string | null | undefined): string => {
    if (!dateTimeString) return "";
    try {
        const date = new Date(dateTimeString);
        // Check if the date is valid
        if (isNaN(date.getTime())) return "";
         // Use UTC hours and minutes to avoid timezone issues with Supabase TIMESTAMPTZ
         const hours = date.getUTCHours().toString().padStart(2, '0');
         const minutes = date.getUTCMinutes().toString().padStart(2, '0');
         return `${hours}:${minutes}`;
    } catch (e) {
        console.error("Error formatting time:", e, "Input:", dateTimeString);
        return "";
    }
};
