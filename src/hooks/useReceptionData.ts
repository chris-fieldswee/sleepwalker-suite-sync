// src/hooks/useReceptionData.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'; // Added useRef
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
    const { data, error } = await supabase.from("rooms").select("id, name, group_type, capacity, color").eq("active", true).order("name");
    if (error) { console.error("Error fetching rooms:", error); toast({ title: "Error", description: "Could not load rooms.", variant: "destructive" }); }
    else { setAvailableRooms(data || []); }
    return data;
  }, [toast]);

  const fetchStaff = useCallback(async () => {
     const { data, error } = await supabase.from("users").select("id, name, first_name, last_name, role").eq("role", "housekeeping").eq("active", true).order("name");
     if (error) { console.error("Error fetching staff:", error); toast({ title: "Error", description: "Failed to fetch staff list.", variant: "destructive"}); }
     else {
       // Construct display name from first_name and last_name if available
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

  // Updated fetchTasks
  const fetchTasks = useCallback(async (
      date: string | null,
      status: TaskStatus | 'all',
      staffId: string,
      roomGroup: RoomGroup | 'all',
      roomId: string
    ) => {
     let query = supabase.from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, actual_time,
        difference, issue_flag, housekeeping_notes, reception_notes, start_time,
        stop_time, issue_description, issue_photo, pause_start, pause_stop, total_pause, created_at,
        room:rooms!inner(id, name, group_type, color),
        user:users(id, name, first_name, last_name)
      `)
      .order("created_at", { ascending: true });

     // Apply date filter (gte today if null, eq specific date otherwise)
     if (date === null) {
        query = query.gte('date', getTodayDateString());
     } else {
        query = query.eq("date", date);
     }

     // Apply Status Filter
     if (status === "all") {
         query = query.in("status", ACTIVE_TASK_STATUSES);
     } else {
         query = query.eq("status", status);
     }

     // Apply Staff Filter
     if (staffId !== "all") {
        if (staffId === "unassigned") query = query.is("user_id", null);
        else query = query.eq("user_id", staffId);
     }

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

        // Construct display name for user if first_name and last_name exist
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
    if (!date) return [];
    const { data, error } = await supabase.from("work_logs")
      .select(`id, user_id, date, time_in, time_out, total_minutes, break_minutes, notes, user:users!inner(name)`)
      .eq("date", date);
    if (error) { console.error("Error fetching work logs:", error); toast({ title: "Error", description: "Failed to fetch work logs.", variant: "destructive" }); return []; }
    else { return (data as WorkLog[]) || []; }
  }, [toast]);


  // --- Main useEffect for Initial Load & Realtime ---
    // Add ref for mount status check in handleRefresh cleanup
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

  useEffect(() => {
    let isMounted = true; // Use local variable for this effect's cleanup
    setLoading(true);

    // Initial data fetch uses current filter state
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
        // Avoid setting loading to false here if only one promise failed, let finally handle it
    }).finally(() => {
        if (isMounted) setLoading(false);
    });

    // Realtime Subscriptions
    let tasksChannel: ReturnType<typeof supabase.channel> | null = null;
    let workLogChannel: ReturnType<typeof supabase.channel> | null = null;

    const currentFilterDate = filterDate || getTodayDateString();
    // Simplified filter for realtime - focus on date. Refetch handles other filters.
    const dateFilterString = filterDate ? `date=eq.${filterDate}` : `date=gte.${getTodayDateString()}`;
    // Staff filter might cause too many channel changes/miss updates if staff filter changes often.
    // Relying on refetch triggered by any relevant date change might be more robust.
    // const staffFilterString = filterStaffId !== 'all' && filterStaffId !== 'unassigned' ? `&user_id=eq.${filterStaffId}` : '';

    console.log("Setting up tasks subscription with filter:", dateFilterString);

    tasksChannel = supabase
      .channel(`reception-tasks-channel-${currentFilterDate}`) // Simplified channel name based on date only
      .on<Task>(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: dateFilterString // Filter primarily by date for subscription stability
        },
        (payload) => {
          console.log("Reception Task Update Received:", payload.eventType, payload.new?.id || payload.old?.id);
           // Refetch tasks based on *current UI filters* when a change occurs on the subscribed date range
           if (isMountedRef.current) { // Use ref to check mount status in async callback
               fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId).then(updatedTasks => {
                  // Double check mount status *after* async operation
                  if (isMountedRef.current) {
                    console.log("Refetched tasks after realtime update:", updatedTasks.length);
                    setTasks(updatedTasks);
                  }
               });
           }
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
           if (isMountedRef.current) { // Check mount status
              fetchWorkLogs(workLogSubscriptionDate).then(updatedLogs => {
                  if (isMountedRef.current) { // Check again after async
                     console.log("Refetched work logs after realtime update:", updatedLogs.length);
                     // Only update state if the fetched logs' date matches the current filter date
                     // (or if filter is null and fetched date is today)
                     if (filterDate === workLogSubscriptionDate || (filterDate === null && workLogSubscriptionDate === getTodayDateString())) {
                         setWorkLogs(updatedLogs);
                     }
                  }
              });
           }
        })
        .subscribe((status, err) => {
            if (err) console.error("Work log subscription error:", err);
            else console.log("Work log subscription status:", status);
        });


    // Cleanup
    return () => {
        isMounted = false; // Set local variable for immediate effect within this cleanup
        console.log("Removing reception realtime channels");
        // Use removeChannel for proper cleanup
        if (tasksChannel) supabase.removeChannel(tasksChannel).catch(err => console.error("Error removing tasks channel:", err));
        if (workLogChannel) supabase.removeChannel(workLogChannel).catch(err => console.error("Error removing work log channel:", err));
    };
  // Re-run effect if any filter changes
  }, [filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId, fetchStaff, fetchRooms, fetchTasks, fetchWorkLogs, toast]);

  // --- Actions ---
  const handleRefresh = async () => {
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
             // Check mount status using the ref before setting state
             if (isMountedRef.current) {
                setLoading(false);
                setRefreshing(false);
             }
        }, 300);
    }
  };


  const handleClearFilters = () => {
    setFilterDate(null);
    setFilterStatus("all");
    setFilterStaffId("all");
    setFilterRoomGroup("all");
    setFilterRoomId("all");
  };

  // --- Derived State (Stats calculation) ---
  const stats = useMemo(() => {
    const currentTasks = Array.isArray(tasks) ? tasks : []; // Ensure tasks is an array
    return {
      // Total active tasks currently matching filters (excluding 'done')
      total: currentTasks.filter(t => ACTIVE_TASK_STATUSES.includes(t.status)).length,
      todo: currentTasks.filter((t) => t.status === "todo").length,
      inProgress: currentTasks.filter((t) => t.status === "in_progress").length,
      // Calculate 'done' based on the specific date filter OR today if filter is null AND task date matches
      done: currentTasks.filter((t) => t.status === "done" && t.date === (filterDate || getTodayDateString())).length,
      // Count *active* tasks that need repair
      repair: currentTasks.filter((t) => t.issue_flag === true && ACTIVE_TASK_STATUSES.includes(t.status)).length,
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
