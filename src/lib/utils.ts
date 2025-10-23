// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
