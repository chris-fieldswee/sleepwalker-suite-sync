// src/hooks/useReceptionData.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";

// Define necessary types (Consider moving to a shared types file)
type TaskStatus = Database["public"]["Enums"]["task_status"];
type RoomGroup = Database["public"]["Enums"]["room_group"];
export interface Room { /* ... */ }
export interface Task { /* ... */ }
export interface Staff { /* ... */ }
export interface WorkLog { /* ... */ }

// Helper function to get today's date string
const getTodayDateString = () => new Date().toISOString().split("T")[0];

// Hook logic
export function useReceptionData() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  // *** MODIFIED: Default filterDate to null for "all upcoming" ***
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>("all");
  const [filterStaffId, setFilterStaffId] = useState("all");
  const [filterRoomGroup, setFilterRoomGroup] = useState<RoomGroup | 'all'>("all");

  // --- Data Fetching Callbacks ---
  const fetchRooms = useCallback(async () => { /* ... unchanged ... */ }, [toast]);
  const fetchStaff = useCallback(async () => { /* ... unchanged ... */ }, [toast]);

  // *** MODIFIED: fetchTasks handles null date and sorts by date ***
  const fetchTasks = useCallback(async (date: string | null, status: string, staffId: string, roomGroup: string) => {
     let query = supabase.from("tasks")
      .select(`id, date, status, cleaning_type, guest_count, time_limit, actual_time, difference, issue_flag, housekeeping_notes, reception_notes, start_time, stop_time, created_at, room:rooms!inner(id, name, group_type, color), user:users(id, name)`)
      // *** Sort by date first, then creation time ***
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

     // *** Apply date filter: gte today if null, eq specific date otherwise ***
     if (date === null) {
        query = query.gte('date', getTodayDateString()); // Fetch from today onwards
     } else {
        query = query.eq("date", date); // Fetch for specific date
     }

     // Apply other filters
     if (status !== "all") query = query.eq("status", status as TaskStatus);
     if (staffId !== "all") {
        if (staffId === "unassigned") query = query.is("user_id", null);
        else query = query.eq("user_id", staffId);
     }

    const { data, error } = await query;
    if (error) { console.error("Error fetching tasks:", error); toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" }); return []; }
    else {
        // Client-side filter for room group (if needed, or adjust DB query)
        const groupFilteredData = roomGroup !== 'all' ? (data || []).filter((task: any) => task.room.group_type === roomGroup) : (data || []);
        return groupFilteredData as Task[];
    }
  }, [toast]); // Dependencies on filters removed as they are passed directly

 const fetchWorkLogs = useCallback(async (date: string | null) => {
    // Only fetch logs if a specific date is selected
    if (!date) return [];
    // ... rest of fetchWorkLogs unchanged ...
  }, [toast]);


  // --- Main useEffect for Initial Load & Realtime ---
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Initial data fetch uses current filter state (date might be null)
    Promise.all([
        fetchStaff(),
        fetchRooms(),
        fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup),
        fetchWorkLogs(filterDate) // Pass current filterDate
    ]).then(([, , tasksData, workLogsData]) => {
        if (isMounted) {
            setTasks(tasksData || []);
            setWorkLogs(workLogsData || []);
        }
    }).catch(error => { /* ... */ }).finally(() => {
        if (isMounted) setLoading(false);
    });

    // Realtime Subscriptions
    // *** Decide on realtime strategy when date filter is null ***
    // Option 1: Only subscribe when a specific date IS selected (simpler)
    // Option 2: Subscribe more broadly (e.g., date >= today) - potentially many updates
    // Option 3: Don't subscribe when date is null, rely on manual refresh

    let tasksChannel: any = null; // Use 'any' or proper Supabase Channel type
    let workLogChannel: any = null;

    // *** Option 1: Only subscribe if a date is selected ***
    if (filterDate) {
        tasksChannel = supabase
          .channel(`reception-tasks-channel-date-${filterDate}`) // Channel name includes date
          .on<Task>(
            "postgres_changes",
            { event: "*", schema: "public", table: "tasks", filter: `date=eq.${filterDate}` },
            (payload) => { /* ... unchanged update logic ... */ }
          )
          .subscribe(/* ... error handling ... */);

        workLogChannel = supabase
            .channel(`reception-work-logs-channel-date-${filterDate}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs', filter: `date=eq.${filterDate}` },
            (payload) => { /* ... unchanged update logic ... */ }
            )
            .subscribe(/* ... error handling ... */);
    } else {
        // No realtime subscription active when viewing "all upcoming"
        console.log("Realtime updates paused (viewing all upcoming tasks).");
    }

    // Cleanup
    return () => {
        isMounted = false;
        console.log("Removing reception realtime channels");
        if (tasksChannel) supabase.removeChannel(tasksChannel).catch(err => console.error("Error removing tasks channel:", err));
        if (workLogChannel) supabase.removeChannel(workLogChannel).catch(err => console.error("Error removing work log channel:", err));
    };
    // Re-run effect if any filter changes
  }, [filterDate, filterStatus, filterStaffId, filterRoomGroup, fetchStaff, fetchRooms, fetchTasks, fetchWorkLogs, toast]);

  // --- Actions ---
  const handleRefresh = async () => { /* ... unchanged ... */ };

  // *** MODIFIED: handleClearFilters sets date to null ***
  const handleClearFilters = () => {
    setFilterDate(null); // Set date filter to null
    setFilterStatus("all");
    setFilterStaffId("all");
    setFilterRoomGroup("all");
    // Data will refetch automatically via useEffect
  };

  // --- Derived State ---
  const stats = useMemo(() => { /* ... unchanged ... */ }, [tasks]);

  return {
    tasks, allStaff, availableRooms, workLogs, loading, refreshing,
    filters: { date: filterDate, status: filterStatus, staffId: filterStaffId, roomGroup: filterRoomGroup },
    filterSetters: { setDate: setFilterDate, setStatus: setFilterStatus, setStaffId: setFilterStaffId, setRoomGroup: setFilterRoomGroup },
    actions: { refresh: handleRefresh, clearFilters: handleClearFilters },
    stats, fetchWorkLogs
  };
}
