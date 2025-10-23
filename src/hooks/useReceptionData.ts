// src/hooks/useReceptionData.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";

// Define necessary types (Consider moving to a shared types file)
type TaskStatus = Database["public"]["Enums"]["task_status"];
type RoomGroup = Database["public"]["Enums"]["room_group"];
export interface Room {
    id: string;
    name: string;
    group_type: RoomGroup;
    capacity: number;
}
export interface Task {
  id: string;
  date: string;
  status: TaskStatus;
  room: { id: string; name: string; group_type: string; color: string | null };
  user: { id: string; name: string } | null;
  cleaning_type: Database["public"]["Enums"]["cleaning_type"];
  guest_count: number;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null;
  stop_time: string | null;
  // Include fields potentially needed for realtime updates/sorting
  created_at?: string;
}
export interface Staff {
  id: string;
  name: string;
  role: string; // Assuming role is selected
}
export interface WorkLog {
  id: string;
  user_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  total_minutes: number | null;
  break_minutes: number | null;
  notes: string | null;
  user: { name: string }; // From the join
}

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
  // Default filterDate to null for "all upcoming"
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>("all");
  const [filterStaffId, setFilterStaffId] = useState("all");
  const [filterRoomGroup, setFilterRoomGroup] = useState<RoomGroup | 'all'>("all");

  // --- Data Fetching Callbacks ---
  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase.from("rooms").select("id, name, group_type, capacity").eq("active", true).order("name");
    if (error) { console.error("Error fetching rooms:", error); toast({ title: "Error", description: "Could not load rooms.", variant: "destructive" }); }
    else { setAvailableRooms(data || []); }
    return data; // Return data for potential chaining
  }, [toast]);

  const fetchStaff = useCallback(async () => {
     const { data, error } = await supabase.from("users").select("id, name, role").eq("role", "housekeeping").eq("active", true).order("name");
     if (error) { console.error("Error fetching staff:", error); toast({ title: "Error", description: "Failed to fetch staff list.", variant: "destructive"}); }
     else { setAllStaff(data || []); }
     return data;
  }, [toast]);

  // fetchTasks handles null date and sorts by date
  const fetchTasks = useCallback(async (date: string | null, status: string, staffId: string, roomGroup: string) => {
     let query = supabase.from("tasks")
      .select(`id, date, status, cleaning_type, guest_count, time_limit, actual_time, difference, issue_flag, housekeeping_notes, reception_notes, start_time, stop_time, created_at, room:rooms!inner(id, name, group_type, color), user:users(id, name)`)
      // Sort by date first, then creation time
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

     // Apply date filter: gte today if null, eq specific date otherwise
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
  }, [toast]);

 const fetchWorkLogs = useCallback(async (date: string | null) => {
    // Only fetch logs if a specific date is selected
    if (!date) return [];
    const { data, error } = await supabase.from("work_logs")
      .select(`id, user_id, date, time_in, time_out, total_minutes, break_minutes, notes, user:users!inner(name)`)
      .eq("date", date);
    if (error) { console.error("Error fetching work logs:", error); toast({ title: "Error", description: "Failed to fetch work logs.", variant: "destructive" }); return []; }
    else { return (data as WorkLog[]) || []; }
  }, [toast]);


  // --- Main useEffect for Initial Load & Realtime ---
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component
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
            // Staff and Rooms are set within their fetch functions
        }
    }).catch(error => {
        console.error("Initial data fetch failed:", error);
        // Toast handled in individual fetch functions
    }).finally(() => {
        if (isMounted) setLoading(false);
    });

    // Realtime Subscriptions
    let tasksChannel: any = null;
    let workLogChannel: any = null;

    // Only subscribe if a date is selected
    if (filterDate) {
        tasksChannel = supabase
          .channel(`reception-tasks-channel-date-${filterDate}`)
          .on<Task>(
            "postgres_changes",
            { event: "*", schema: "public", table: "tasks", filter: `date=eq.${filterDate}` },
            (payload) => {
              console.log("Reception Task Update:", payload);
              // Refetch tasks based on current filters when a change occurs on the filtered date
              fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup).then(updatedTasks => {
                  if (isMounted) setTasks(updatedTasks);
              });

              // Notifications
               if (payload.eventType === 'UPDATE') { /* ... notification logic ... */ }
            }
          )
          .subscribe((status, err) => { /* ... error handling ... */ });

        workLogChannel = supabase
            .channel(`reception-work-logs-channel-date-${filterDate}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs', filter: `date=eq.${filterDate}` },
            (payload) => {
              console.log('Work log change received:', payload);
              // Refetch work logs on change
              fetchWorkLogs(filterDate).then(updatedLogs => {
                  if (isMounted) setWorkLogs(updatedLogs);
              });
            })
            .subscribe((status, err) => { /* ... error handling ... */ });
    } else {
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
  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setLoading(true); // Show loading indicator during refresh
    try {
        // Refetch based on current filters
        await Promise.all([
            fetchStaff(),
            fetchRooms(),
            fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup).then(setTasks),
            fetchWorkLogs(filterDate).then(setWorkLogs) // Pass current date filter
        ]);
        toast({ title: "Data refreshed" });
    } catch (error) {
        console.error("Refresh failed:", error);
        toast({ title: "Error", description: "Failed to refresh data.", variant: "destructive" });
    } finally {
        setTimeout(() => { setLoading(false); setRefreshing(false); }, 300);
    }
  };

  // handleClearFilters sets date to null
  const handleClearFilters = () => {
    setFilterDate(null);
    setFilterStatus("all");
    setFilterStaffId("all");
    setFilterRoomGroup("all");
  };

  // --- Derived State ---
  const stats = useMemo(() => {
    // *** FIX: Ensure tasks is always an array ***
    const currentTasks = Array.isArray(tasks) ? tasks : [];
    const total = currentTasks.length;
    return {
      total: total,
      todo: currentTasks.filter((t) => t.status === "todo").length,
      inProgress: currentTasks.filter((t) => t.status === "in_progress").length,
      done: currentTasks.filter((t) => t.status === "done").length,
      repair: currentTasks.filter((t) => t.issue_flag).length,
    };
  }, [tasks]); // Dependency remains the same


  return {
    tasks, allStaff, availableRooms, workLogs, loading, refreshing,
    filters: { date: filterDate, status: filterStatus, staffId: filterStaffId, roomGroup: filterRoomGroup },
    filterSetters: { setDate: setFilterDate, setStatus: setFilterStatus, setStaffId: setFilterStaffId, setRoomGroup: setFilterRoomGroup },
    actions: { refresh: handleRefresh, clearFilters: handleClearFilters },
    stats, fetchWorkLogs
  };
}
