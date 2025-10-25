// src/hooks/useReceptionData.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";

// Define necessary types
type TaskStatus = Database["public"]["Enums"]["task_status"];
type RoomGroup = Database["public"]["Enums"]["room_group"];
export interface Room {
    id: string;
    name: string;
    group_type: RoomGroup;
    capacity: number;
    // Add color if you need it for the room filter dropdown, otherwise optional
    color?: string | null;
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
  created_at?: string;
}
export interface Staff {
  id: string;
  name: string;
  role: string;
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
  user: { name: string };
}

const getTodayDateString = () => new Date().toISOString().split("T")[0];

// Define active statuses for the 'all' filter
const ACTIVE_TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'paused', 'repair_needed'];

export function useReceptionData() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [filterDate, setFilterDate] = useState<string | null>(null); // Default to null (upcoming tasks)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>("all"); // Default to show all active
  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [filterRoomGroup, setFilterRoomGroup] = useState<RoomGroup | 'all'>("all");
  const [filterRoomId, setFilterRoomId] = useState<string>("all"); // Added Room ID filter

  // --- Data Fetching Callbacks ---
  const fetchRooms = useCallback(async () => {
    // Select color if needed for dropdown styling
    const { data, error } = await supabase.from("rooms").select("id, name, group_type, capacity, color").eq("active", true).order("name");
    if (error) { console.error("Error fetching rooms:", error); toast({ title: "Error", description: "Could not load rooms.", variant: "destructive" }); }
    else { setAvailableRooms(data || []); }
    return data;
  }, [toast]);

  const fetchStaff = useCallback(async () => {
     const { data, error } = await supabase.from("users").select("id, name, role").eq("role", "housekeeping").eq("active", true).order("name");
     if (error) { console.error("Error fetching staff:", error); toast({ title: "Error", description: "Failed to fetch staff list.", variant: "destructive"}); }
     else { setAllStaff(data || []); }
     return data;
  }, [toast]);

  // Updated fetchTasks
  const fetchTasks = useCallback(async (
      date: string | null,
      status: TaskStatus | 'all',
      staffId: string,
      roomGroup: RoomGroup | 'all',
      roomId: string // Added roomId parameter
    ) => {
     let query = supabase.from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, actual_time,
        difference, issue_flag, housekeeping_notes, reception_notes, start_time,
        stop_time, created_at,
        room:rooms!inner(id, name, group_type, color),
        user:users(id, name)
      `)
      .order("created_at", { ascending: true }); // Primary sort by creation time or room name?

     // Apply date filter (gte today if null, eq specific date otherwise)
     if (date === null) {
        query = query.gte('date', getTodayDateString());
     } else {
        query = query.eq("date", date);
     }

     // Apply Status Filter
     if (status === "all") {
         query = query.in("status", ACTIVE_TASK_STATUSES); // Fetch only active statuses
     } else {
         query = query.eq("status", status); // Fetch specific status
     }

     // Apply Staff Filter
     if (staffId !== "all") {
        if (staffId === "unassigned") query = query.is("user_id", null);
        else query = query.eq("user_id", staffId);
     }

     // Apply Room Group Filter (applied client-side below for now, could be done in DB)
     // if (roomGroup !== 'all') { /* DB filter possible here */ }

     // Apply Room ID Filter
     if (roomId !== 'all') {
         query = query.eq("room_id", roomId);
     }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching tasks:", error);
        toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" });
        return [];
    } else {
        // Client-side filter for room group (if not done in DB query)
        const groupFilteredData = roomGroup !== 'all'
            ? (data || []).filter((task: any) => task.room.group_type === roomGroup)
            : (data || []);
        return groupFilteredData as Task[];
    }
  }, [toast]); // Dependencies: only toast needed directly here

 const fetchWorkLogs = useCallback(async (date: string | null) => {
    if (!date) return [];
    const { data, error } = await supabase.from("work_logs")
      .select(`id, user_id, date, time_in, time_out, total_minutes, break_minutes, notes, user:users!inner(name)`)
      .eq("date", date);
    if (error) { console.error("Error fetching work logs:", error); toast({ title: "Error", description: "Failed to fetch work logs.", variant: "destructive" }); return []; }
    else { return (data as WorkLog[]) || []; }
  }, [toast]);


  // --- Main useEffect for Initial Load & Realtime ---
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Initial data fetch uses current filter state
    Promise.all([
        fetchStaff(),
        fetchRooms(),
        fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId), // Pass roomId
        fetchWorkLogs(filterDate)
    ]).then(([, , tasksData, workLogsData]) => {
        if (isMounted) {
            setTasks(tasksData || []);
            setWorkLogs(workLogsData || []);
        }
    }).catch(error => {
        console.error("Initial data fetch failed:", error);
    }).finally(() => {
        if (isMounted) setLoading(false);
    });

    // Realtime Subscriptions
    let tasksChannel: any = null;
    let workLogChannel: any = null;

    const currentFilterDate = filterDate || getTodayDateString(); // Use today if date filter is null for channel
    const dateFilterString = filterDate ? `date=eq.${filterDate}` : `date=gte.${getTodayDateString()}`; // Adjust filter for subscription

    tasksChannel = supabase
      .channel(`reception-tasks-channel-${currentFilterDate}-${filterStatus}-${filterStaffId}-${filterRoomGroup}-${filterRoomId}`) // More specific channel
      .on<Task>(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "tasks",
            // Apply essential filters to subscription if possible
            // Note: Complex filters like .in() might not work perfectly here,
            // but date and user_id should. Rely on refetch for accuracy.
            filter: `${dateFilterString}${filterStaffId !== 'all' && filterStaffId !== 'unassigned' ? `&user_id=eq.${filterStaffId}` : ''}`
        },
        (payload) => {
          console.log("Reception Task Update:", payload);
          // Refetch tasks based on *current filters* when any relevant change occurs
          // Check if the changed task still matches current filters before updating state
           fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId).then(updatedTasks => {
              if (isMounted) setTasks(updatedTasks);
           });
           // Add/Update notification logic if needed
        }
      )
      .subscribe((status, err) => {
          if (err) console.error("Task subscription error:", err);
          else console.log("Task subscription status:", status);
      });

    // Work log subscription (only if a specific date is selected)
    if (filterDate) {
        workLogChannel = supabase
            .channel(`reception-work-logs-channel-date-${filterDate}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs', filter: `date=eq.${filterDate}` },
            (payload) => {
              console.log('Work log change received:', payload);
              fetchWorkLogs(filterDate).then(updatedLogs => {
                  if (isMounted) setWorkLogs(updatedLogs);
              });
            })
            .subscribe((status, err) => {
                if (err) console.error("Work log subscription error:", err);
                else console.log("Work log subscription status:", status);
            });
    } else {
        console.log("Work log realtime updates paused (no specific date selected).");
    }

    // Cleanup
    return () => {
        isMounted = false;
        console.log("Removing reception realtime channels");
        if (tasksChannel) supabase.removeChannel(tasksChannel).catch(err => console.error("Error removing tasks channel:", err));
        if (workLogChannel) supabase.removeChannel(workLogChannel).catch(err => console.error("Error removing work log channel:", err));
    };
  // Re-run effect if any filter changes
  }, [filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId, fetchStaff, fetchRooms, fetchTasks, fetchWorkLogs, toast]); // Added filterRoomId

  // --- Actions ---
  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setLoading(true);
    try {
        await Promise.all([
            fetchStaff(),
            fetchRooms(),
            fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId).then(setTasks), // Pass roomId
            fetchWorkLogs(filterDate).then(setWorkLogs)
        ]);
        toast({ title: "Data refreshed" });
    } catch (error) {
        console.error("Refresh failed:", error);
        toast({ title: "Error", description: "Failed to refresh data.", variant: "destructive" });
    } finally {
        setTimeout(() => { setLoading(false); setRefreshing(false); }, 300);
    }
  };

  // Updated handleClearFilters
  const handleClearFilters = () => {
    setFilterDate(null); // Default to null (upcoming tasks)
    setFilterStatus("all"); // Default to all active
    setFilterStaffId("all");
    setFilterRoomGroup("all");
    setFilterRoomId("all"); // Reset room filter
  };

  // --- Derived State (Stats calculation remains the same, based on fetched tasks) ---
  const stats = useMemo(() => {
    const currentTasks = Array.isArray(tasks) ? tasks : [];
    // Stats now reflect only the *currently fetched* (potentially filtered) tasks
    const totalFetched = currentTasks.length;
    // Note: 'done' tasks are excluded by fetchTasks unless status filter is 'done' (which we removed from UI)
    // 'repair' count is based on issue_flag within the fetched tasks.
    return {
      total: totalFetched, // Represents total matching current filters (excluding 'done' by default)
      todo: currentTasks.filter((t) => t.status === "todo").length,
      inProgress: currentTasks.filter((t) => t.status === "in_progress").length,
      done: currentTasks.filter((t) => t.status === "done").length, // Will usually be 0 unless fetching specifically
      repair: currentTasks.filter((t) => t.issue_flag).length,
    };
  }, [tasks]);


  return {
    tasks, allStaff, availableRooms, workLogs, loading, refreshing,
    // Include roomId in filters
    filters: { date: filterDate, status: filterStatus, staffId: filterStaffId, roomGroup: filterRoomGroup, roomId: filterRoomId },
    // Include setter for roomId
    filterSetters: { setDate: setFilterDate, setStatus: setFilterStatus, setStaffId: setFilterStaffId, setRoomGroup: setFilterRoomGroup, setRoomId: setFilterRoomId },
    actions: { refresh: handleRefresh, clearFilters: handleClearFilters },
    stats, fetchWorkLogs
  };
}
