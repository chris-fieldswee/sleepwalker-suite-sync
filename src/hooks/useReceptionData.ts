// src/hooks/useReceptionData.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// Define active statuses for the 'all' filter and stats calculation
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

  // Ref for checking mount status in async callbacks
  const isMountedRef = useRef(true);
  useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
  }, []);


  // --- Data Fetching Callbacks ---
  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase.from("rooms").select("id, name, group_type, capacity, color").eq("active", true).order("name");
    if (error) { console.error("Error fetching rooms:", error); toast({ title: "Error", description: "Could not load rooms.", variant: "destructive" }); }
    else if (isMountedRef.current) { setAvailableRooms(data || []); }
    return data;
  }, [toast]);

  const fetchStaff = useCallback(async () => {
     // Fetch all active users (not just housekeeping) for broader functionality
     const { data, error } = await supabase.from("users").select("id, name, first_name, last_name, role").eq("active", true).order("name");
     if (error) { console.error("Error fetching staff:", error); toast({ title: "Error", description: "Failed to fetch staff list.", variant: "destructive"}); }
     else if (isMountedRef.current) {
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
     let query = supabase.from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, actual_time,
        difference, issue_flag, housekeeping_notes, reception_notes, start_time,
        stop_time, issue_description, issue_photo, pause_start, pause_stop, total_pause, created_at,
        room:rooms!inner(id, name, group_type, color),
        user:users(id, name, first_name, last_name)
      `)
      .order("created_at", { ascending: true });

     // Apply date filter
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

     // Apply Room ID Filter - now applied client-side after group filtering
     // Room Group filter is applied client-side after fetch

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching tasks:", error);
        toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" });
        return [];
    } else {
        // Client-side filter for room group
        let filteredData = data || [];
        if (roomGroup !== 'all') {
            filteredData = filteredData.filter((task: any) => task.room.group_type === roomGroup);
        }
        // Client-side filter for room ID (if not 'all')
        if (roomId !== 'all') {
            // Ensure room_id exists before filtering
            filteredData = filteredData.filter((task: any) => task.room && task.room.id === roomId);
        }

        // Construct display name for user
        const tasksWithDisplayNames = filteredData.map((task: any) => ({
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
  }, [toast]); // Dependencies: toast

 const fetchWorkLogs = useCallback(async (date: string | null) => {
    if (!date) return [];
    const { data, error } = await supabase.from("work_logs")
      .select(`id, user_id, date, time_in, time_out, total_minutes, break_minutes, notes, user:users!inner(name)`)
      .eq("date", date);
    if (error) { console.error("Error fetching work logs:", error); toast({ title: "Error", description: "Failed to fetch work logs.", variant: "destructive" }); return []; }
    else if (isMountedRef.current) { return (data as WorkLog[]) || []; }
    else { return []; }
  }, [toast]);


  // --- Main useEffect for Initial Load & Realtime ---
  useEffect(() => {
    let isMounted = true; // Use local variable for this effect's cleanup
    setLoading(true);

    // Initial data fetch uses current filter state
    Promise.all([
        fetchStaff(),
        fetchRooms(),
        fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId),
        fetchWorkLogs(filterDate || getTodayDateString())
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
    let tasksChannel: ReturnType<typeof supabase.channel> | null = null;
    let workLogChannel: ReturnType<typeof supabase.channel> | null = null;

    const dateFilterString = filterDate ? `date=eq.${filterDate}` : `date=gte.${getTodayDateString()}`;
    const channelDateSuffix = filterDate || 'upcoming';

    console.log("Setting up tasks subscription with filter:", dateFilterString);

    tasksChannel = supabase
      .channel(`reception-tasks-channel-${channelDateSuffix}`)
      .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: dateFilterString
        },
        (payload) => {
          console.log("Reception Task Update Received:", payload.eventType, payload.new || payload.old);
           if (isMountedRef.current) {
               fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId).then(updatedTasks => {
                  if (isMountedRef.current) {
                    console.log("Refetched tasks after realtime update:", updatedTasks.length);
                    setTasks(updatedTasks); // Update the state with newly fetched tasks
                  }
               });
           }
        }
      )
      .subscribe((status, err) => {
          if (err) console.error("Task subscription error:", err);
          else console.log("Task subscription status:", status);
      });

    const workLogSubscriptionDate = filterDate || getTodayDateString();

    workLogChannel = supabase
        .channel(`reception-work-logs-channel-date-${workLogSubscriptionDate}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_logs', filter: `date=eq.${workLogSubscriptionDate}` },
        (payload) => {
          console.log('Work log change received:', payload);
           if (isMountedRef.current) {
              fetchWorkLogs(workLogSubscriptionDate).then(updatedLogs => {
                  if (isMountedRef.current) {
                     console.log("Refetched work logs after realtime update:", updatedLogs.length);
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
        isMounted = false;
        console.log("Removing reception realtime channels");
        if (tasksChannel) supabase.removeChannel(tasksChannel).catch(err => console.error("Error removing tasks channel:", err));
        if (workLogChannel) supabase.removeChannel(workLogChannel).catch(err => console.error("Error removing work log channel:", err));
    };
  // Re-run effect if any filter changes
  }, [filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId, fetchStaff, fetchRooms, fetchTasks, fetchWorkLogs, toast]); // Include all dependencies

  // --- Actions ---
  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    setLoading(true);
    try {
        const currentSelectedDate = filterDate || getTodayDateString();
        const results = await Promise.allSettled([
            fetchStaff(),
            fetchRooms(),
            fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId),
            fetchWorkLogs(currentSelectedDate)
        ]);

        if (isMountedRef.current) {
            let refreshError = false;
            // Update state based on fulfilled promises
            if (results[0].status === 'fulfilled') { /* Potentially update staff if needed, handled by fetchStaff already */ }
            else { console.error("Refresh failed for staff:", results[0].reason); refreshError = true; }

            if (results[1].status === 'fulfilled') { /* Potentially update rooms if needed, handled by fetchRooms already */ }
            else { console.error("Refresh failed for rooms:", results[1].reason); refreshError = true; }

            if (results[2].status === 'fulfilled') {
                setTasks(results[2].value || []);
            } else {
                console.error("Refresh failed for tasks:", results[2].reason);
                refreshError = true;
            }
            if (results[3].status === 'fulfilled') {
                setWorkLogs(results[3].value || []);
            } else {
                console.error("Refresh failed for work logs:", results[3].reason);
                refreshError = true;
            }

            if (refreshError) {
                toast({ title: "Refresh Partially Failed", description: "Some data could not be refreshed.", variant: "destructive" });
            } else {
                toast({ title: "Data refreshed" });
            }
        }
    } catch (error: any) {
        console.error("Unexpected error during refresh:", error);
         if (isMountedRef.current) {
             toast({ title: "Error", description: "An unexpected error occurred during refresh.", variant: "destructive" });
         }
    } finally {
        setTimeout(() => {
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
    // ** CORRECTED: Calculate directly from `tasks` state **
    const currentTasks = Array.isArray(tasks) ? tasks : []; // Ensure tasks is an array
    const relevantDate = filterDate || getTodayDateString(); // Date for 'done' count

    console.log(`Calculating stats based on ${currentTasks.length} tasks for date ${relevantDate}`); // Debug log

    return {
      // Total count of tasks currently held in the `tasks` state (after fetching/filtering)
      // that are in an "active" state (not 'done').
      total: currentTasks.filter(t => ACTIVE_TASK_STATUSES.includes(t.status)).length,

      todo: currentTasks.filter((t) => t.status === "todo").length,
      inProgress: currentTasks.filter((t) => t.status === "in_progress").length,

      // Count tasks marked 'done' specifically for the relevant date.
      done: currentTasks.filter((t) => t.status === "done" && t.date === relevantDate).length,

      // Count *active* tasks that currently have an issue flag.
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
