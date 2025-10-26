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
  issue_description: string | null;
  issue_photo: string | null;
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
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
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>("all");
  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [filterRoomGroup, setFilterRoomGroup] = useState<RoomGroup | 'all'>("all");
  const [filterRoomId, setFilterRoomId] = useState<string>("all");

  // --- Data Fetching Callbacks ---
  const fetchRooms = useCallback(async () => {
    // ... (fetchRooms implementation remains the same) ...
    const { data, error } = await supabase.from("rooms").select("id, name, group_type, capacity, color").eq("active", true).order("name");
    if (error) { console.error("Error fetching rooms:", error); toast({ title: "Error", description: "Could not load rooms.", variant: "destructive" }); }
    else { setAvailableRooms(data || []); }
    return data;
  }, [toast]);

  const fetchStaff = useCallback(async () => {
     // ... (fetchStaff implementation remains the same) ...
     const { data, error } = await supabase.from("users").select("id, name, first_name, last_name, role").eq("role", "housekeeping").eq("active", true).order("name");
     if (error) { console.error("Error fetching staff:", error); toast({ title: "Error", description: "Failed to fetch staff list.", variant: "destructive"}); }
     else {
       const staffWithDisplayNames = (data || []).map(staff => ({
         ...staff,
         name: staff.first_name && staff.last_name
           ? `${staff.first_name} ${staff.last_name}`
           : staff.name
       }));
       setAllStaff(staffWithDisplayNames);
     }
     return data;
  }, [toast]);

  const fetchTasks = useCallback(async (
      date: string | null,
      status: TaskStatus | 'all',
      staffId: string,
      roomGroup: RoomGroup | 'all',
      roomId: string
    ) => {
     // ... (fetchTasks implementation remains the same) ...
     let query = supabase.from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, actual_time,
        difference, issue_flag, housekeeping_notes, reception_notes, start_time,
        stop_time, issue_description, issue_photo, pause_start, pause_stop, total_pause, created_at,
        room:rooms!inner(id, name, group_type, color),
        user:users(id, name, first_name, last_name)
      `)
      .order("created_at", { ascending: true });

     if (date === null) {
        query = query.gte('date', getTodayDateString());
     } else {
        query = query.eq("date", date);
     }

     if (status === "all") {
         query = query.in("status", ACTIVE_TASK_STATUSES);
     } else {
         query = query.eq("status", status);
     }

     if (staffId !== "all") {
        if (staffId === "unassigned") query = query.is("user_id", null);
        else query = query.eq("user_id", staffId);
     }

     if (roomId !== 'all') {
         query = query.eq("room_id", roomId);
     }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching tasks:", error);
        toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" });
        return [];
    } else {
        const groupFilteredData = roomGroup !== 'all'
            ? (data || []).filter((task: any) => task.room.group_type === roomGroup)
            : (data || []);

        const tasksWithDisplayNames = groupFilteredData.map((task: any) => ({
          ...task,
          user: task.user ? {
            ...task.user,
            name: task.user.first_name && task.user.last_name
              ? `${task.user.first_name} ${task.user.last_name}`
              : task.user.name
          } : null
        }));

        return tasksWithDisplayNames as Task[];
    }
  }, [toast]);

 const fetchWorkLogs = useCallback(async (date: string | null) => {
    // ... (fetchWorkLogs implementation remains the same) ...
    if (!date) return [];
    const { data, error } = await supabase.from("work_logs")
      .select(`id, user_id, date, time_in, time_out, total_minutes, break_minutes, notes, user:users!inner(name)`)
      .eq("date", date);
    if (error) { console.error("Error fetching work logs:", error); toast({ title: "Error", description: "Failed to fetch work logs.", variant: "destructive" }); return []; }
    else { return (data as WorkLog[]) || []; }
  }, [toast]);


  // --- Main useEffect for Initial Load & Realtime ---
  useEffect(() => {
    // ... (useEffect logic remains the same) ...
    let isMounted = true;
    setLoading(true);

    Promise.all([
        fetchStaff(),
        fetchRooms(),
        fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId),
        fetchWorkLogs(filterDate || getTodayDateString()) // Fetch logs for today if no date selected initially
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

    const currentFilterDate = filterDate || getTodayDateString();
    // Simplified filter for realtime - focus on date and maybe staff if needed, avoid over-filtering
    const dateFilterString = filterDate ? `date=eq.${filterDate}` : `date=gte.${getTodayDateString()}`;
    // Consider if staff filtering is essential for realtime or if refetching covers it
    const staffFilterString = filterStaffId !== 'all' && filterStaffId !== 'unassigned' ? `&user_id=eq.${filterStaffId}` : '';

    console.log("Setting up tasks subscription with filter:", `${dateFilterString}${staffFilterString}`);

    tasksChannel = supabase
      .channel(`reception-tasks-channel-${currentFilterDate}-${filterStaffId}`) // Simplified channel name
      .on<Task>(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `${dateFilterString}${staffFilterString}`
        },
        (payload) => {
          console.log("Reception Task Update Received:", payload.eventType, payload.new?.id || payload.old?.id);
           // Refetch tasks based on current filters when a change occurs
           fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId).then(updatedTasks => {
              if (isMounted) {
                console.log("Refetched tasks after realtime update:", updatedTasks.length);
                setTasks(updatedTasks);
              }
           });
        }
      )
      .subscribe((status, err) => {
          if (err) console.error("Task subscription error:", err);
          else console.log("Task subscription status:", status);
      });

    // Determine the date for work log subscription
    const workLogSubscriptionDate = filterDate || getTodayDateString(); // Subscribe for today if no date filter

    workLogChannel = supabase
        .channel(`reception-work-logs-channel-date-${workLogSubscriptionDate}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs', filter: `date=eq.${workLogSubscriptionDate}` },
        (payload) => {
          console.log('Work log change received:', payload);
          // Refetch work logs only for the specific date the channel is listening to
          fetchWorkLogs(workLogSubscriptionDate).then(updatedLogs => {
              if (isMounted) {
                 console.log("Refetched work logs after realtime update:", updatedLogs.length);
                 // Only update if the fetched date matches the current filter date (or if filter is null and fetched date is today)
                 if (filterDate === workLogSubscriptionDate || (filterDate === null && workLogSubscriptionDate === getTodayDateString())) {
                     setWorkLogs(updatedLogs);
                 }
              }
          });
        })
        .subscribe((status, err) => {
            if (err) console.error("Work log subscription error:", err);
            else console.log("Work log subscription status:", status);
        });


    // Cleanup
    return () => {
        isMounted = false;
        console.log("Removing reception realtime channels");
        if (tasksChannel) supabase.removeChannel(tasksChannel).catch(err => console.error("Error removing tasks channel:", err));
        if (workLogChannel) supabase.removeChannel(workLogChannel).catch(err => console.error("Error removing work log channel:", err));
    };
  // Re-run effect if any filter changes
  }, [filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId, fetchStaff, fetchRooms, fetchTasks, fetchWorkLogs, toast]);

  // --- Actions ---
  const handleRefresh = async () => {
    // ... (handleRefresh implementation remains the same) ...
    if (refreshing || loading) return;
    setRefreshing(true);
    setLoading(true); // Ensure loading is true during refresh
    try {
        const currentSelectedDate = filterDate || getTodayDateString(); // Use today if filterDate is null
        await Promise.all([
            fetchStaff(),
            fetchRooms(),
            fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId).then(setTasks),
            fetchWorkLogs(currentSelectedDate).then(setWorkLogs) // Fetch logs for the relevant date
        ]);
        toast({ title: "Data refreshed" });
    } catch (error: any) { // Added type annotation
        console.error("Refresh failed:", error);
        toast({ title: "Error", description: `Failed to refresh data: ${error.message}`, variant: "destructive" });
    } finally {
        // Use a small delay to allow UI to settle before removing loading/refreshing state
        setTimeout(() => {
             if (isMountedRef.current) { // Check if component is still mounted
                setLoading(false);
                setRefreshing(false);
             }
        }, 300);
    }
  };
   // Add a ref to track mount status for handleRefresh cleanup
   const isMountedRef = useRef(true);
   useEffect(() => {
       isMountedRef.current = true;
       return () => { isMountedRef.current = false; };
   }, []);


  const handleClearFilters = () => {
    // ... (handleClearFilters implementation remains the same) ...
    setFilterDate(null);
    setFilterStatus("all");
    setFilterStaffId("all");
    setFilterRoomGroup("all");
    setFilterRoomId("all");
  };

  // --- Derived State (Stats calculation) ---
  // ** CORRECTED: Calculate stats based on the `tasks` state variable **
  const stats = useMemo(() => {
    const currentTasks = Array.isArray(tasks) ? tasks : []; // Ensure tasks is an array
    return {
      total: currentTasks.filter(t => ACTIVE_TASK_STATUSES.includes(t.status)).length, // Count only active tasks for total
      todo: currentTasks.filter((t) => t.status === "todo").length,
      inProgress: currentTasks.filter((t) => t.status === "in_progress").length,
      // Calculate 'done' based on the specific date filter or today if filter is null
      done: currentTasks.filter((t) => t.status === "done" && t.date === (filterDate || getTodayDateString())).length,
      repair: currentTasks.filter((t) => t.issue_flag === true && ACTIVE_TASK_STATUSES.includes(t.status)).length, // Count active repair tasks
    };
  }, [tasks, filterDate]); // Recalculate when tasks or filterDate changes


  return {
    tasks, allStaff, availableRooms, workLogs, loading, refreshing,
    filters: { date: filterDate, status: filterStatus, staffId: filterStaffId, roomGroup: filterRoomGroup, roomId: filterRoomId },
    filterSetters: { setDate: setFilterDate, setStatus: setFilterStatus, setStaffId: setFilterStaffId, setRoomGroup: setFilterRoomGroup, setRoomId: setFilterRoomId },
    actions: { refresh: handleRefresh, clearFilters: handleClearFilters },
    stats,
    fetchWorkLogs // Expose fetchWorkLogs if needed by other components
  };
}
