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
    capacity_label?: string | null;
    color?: string | null;
    capacity_configurations?: any; // JSONB array of capacity configurations
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
  const [allTasksForStats, setAllTasksForStats] = useState<Task[]>([]); // Unfiltered tasks for stats
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [openIssuesCount, setOpenIssuesCount] = useState<number>(0); // Count of open issues
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>("all");
  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [filterRoomGroup, setFilterRoomGroup] = useState<RoomGroup | 'all'>("all");
  const [filterRoomId, setFilterRoomId] = useState<string>("all");
  const [fetchAllTasks, setFetchAllTasks] = useState<boolean>(false); // New state to control fetching all tasks

  // Ref for checking mount status in async callbacks
  const isMountedRef = useRef(true);
  useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
  }, []);


  // --- Data Fetching Callbacks ---
  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase.from("rooms").select("id, name, group_type, capacity, capacity_label, color, capacity_configurations").eq("active", true).order("name");
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
      roomId: string,
      fetchAllTasks: boolean = false // New parameter to fetch all tasks regardless of date/status
    ) => {
     console.log('fetchTasks called with:', { date, status, staffId, roomGroup, roomId, fetchAllTasks });
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
     if (fetchAllTasks) {
       // Fetch all tasks regardless of date
       // Don't apply date filter
     } else {
       // Apply date filter based on date parameter
       if (date === null) {
          query = query.gte('date', getTodayDateString());
       } else {
          query = query.eq("date", date);
       }
     }

     // Apply Status Filter
     if (fetchAllTasks) {
       // Fetch all tasks regardless of status
       // Don't apply status filter
     } else if (status === "all") {
       // When status is "all" and not fetching all tasks, fetch all statuses (not just active ones)
       // This is needed for "open" tab which shows all statuses from current/future dates
       // Don't apply status filter - get all statuses
     } else {
       // Apply specific status filter
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
        console.log(`Fetched ${data?.length || 0} tasks (fetchAllTasks: ${fetchAllTasks}, date: ${date}, status: ${status})`);
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

  // Fetch all tasks for stats calculation (unfiltered - all tasks)
  const fetchAllTasksForStats = useCallback(async () => {
    try {
      console.log("fetchAllTasksForStats: Starting fetch...");
      // Use left join instead of inner join to include all tasks even if room is missing
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, guest_count, time_limit, actual_time,
          difference, issue_flag, housekeeping_notes, reception_notes, start_time,
          stop_time, issue_description, issue_photo, pause_start, pause_stop, total_pause, created_at,
          room:rooms(id, name, group_type, color),
          user:users(id, name, first_name, last_name)
        `)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching all tasks for stats:", error);
        toast({ title: "Error", description: `Failed to fetch tasks for stats: ${error.message}`, variant: "destructive" });
        return [];
      }

      console.log(`fetchAllTasksForStats: Raw data from query: ${data?.length || 0} tasks`);

      // Construct display name for user
      const tasksWithDisplayNames = (data || []).map((task: any) => ({
        ...task,
        user: task.user ? {
          ...task.user,
          name: task.user.first_name && task.user.last_name
            ? `${task.user.first_name} ${task.user.last_name}`
            : task.user.name
        } : null
      }));

      console.log(`fetchAllTasksForStats: Processed ${tasksWithDisplayNames.length} tasks for stats`);
      console.log(`fetchAllTasksForStats: isMountedRef.current = ${isMountedRef.current}`);

      // Always set state, but check mount status for safety
      setAllTasksForStats(tasksWithDisplayNames as Task[]);
      console.log(`fetchAllTasksForStats: State updated with ${tasksWithDisplayNames.length} tasks`);
      
      return tasksWithDisplayNames as Task[];
    } catch (error) {
      console.error("Error in fetchAllTasksForStats:", error);
      toast({ title: "Error", description: "Failed to fetch tasks for stats", variant: "destructive" });
      return [];
    }
  }, [toast]);

  // Fetch count of open issues for repair metric
  const fetchOpenIssuesCount = useCallback(async () => {
    try {
      const { data, error, count } = await supabase
        .from("issues")
        .select("*", { count: "exact", head: true })
        .in("status", ["open", "in_progress"]);

      if (error) {
        console.error("Error fetching open issues count:", error);
        return 0;
      }

      if (isMountedRef.current) {
        setOpenIssuesCount(count || 0);
      }
      return count || 0;
    } catch (error) {
      console.error("Error in fetchOpenIssuesCount:", error);
      return 0;
    }
  }, []);


  // --- Main useEffect for Initial Load & Realtime ---
  useEffect(() => {
    let isMounted = true; // Use local variable for this effect's cleanup
    setLoading(true);

    // Initial data fetch uses current filter state
    Promise.all([
        fetchStaff(),
        fetchRooms(),
        fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId, fetchAllTasks),
        fetchWorkLogs(filterDate || getTodayDateString()),
        fetchAllTasksForStats(), // Fetch all tasks for stats
        fetchOpenIssuesCount() // Fetch open issues count
    ]).then(([, , tasksData, workLogsData, allTasksData, issuesCount]) => {
        if (isMounted) {
            setTasks(tasksData || []);
            setWorkLogs(workLogsData || []);
            // allTasksData and issuesCount are handled by their respective functions setting state
            console.log(`[INIT] Initial fetch complete: ${tasksData?.length || 0} filtered tasks, ${allTasksData?.length || 0} all tasks for stats, ${issuesCount || 0} open issues`);
            
            // If allTasksForStats is still empty after fetch, log a warning
            if (!allTasksData || allTasksData.length === 0) {
                console.warn(`[INIT] WARNING: fetchAllTasksForStats returned empty or failed. Will use filtered tasks as fallback in stats.`);
            }
        }
    }).catch(error => {
        console.error("[INIT] Initial data fetch failed:", error);
        // On error, at least set the tasks we have
        if (isMounted) {
            console.log(`[INIT] Error occurred, but will try to use filtered tasks if available`);
        }
    }).finally(() => {
        if (isMounted) setLoading(false);
    });

    // Realtime Subscriptions
    let tasksChannel: ReturnType<typeof supabase.channel> | null = null;
    let workLogChannel: ReturnType<typeof supabase.channel> | null = null;
    let issuesChannel: ReturnType<typeof supabase.channel> | null = null;

    // Only apply date filter to realtime subscription if not fetching all tasks
    const dateFilterString = fetchAllTasks 
      ? undefined // No date filter when fetching all tasks
      : (filterDate ? `date=eq.${filterDate}` : `date=gte.${getTodayDateString()}`);
    const channelDateSuffix = fetchAllTasks ? 'all' : (filterDate || 'upcoming');

    console.log("Setting up tasks subscription with filter:", dateFilterString || 'all tasks');

    const subscriptionConfig: any = {
        event: "*",
        schema: "public",
        table: "tasks"
    };
    
    // Only add date filter if we're not fetching all tasks
    if (!fetchAllTasks && dateFilterString) {
        subscriptionConfig.filter = dateFilterString;
    }

    tasksChannel = supabase
      .channel(`reception-tasks-channel-${channelDateSuffix}`)
      .on(
        "postgres_changes",
        subscriptionConfig,
        (payload) => {
          console.log("Reception Task Update Received:", payload.eventType, payload.new || payload.old);
           if (isMountedRef.current) {
               fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId, fetchAllTasks).then(updatedTasks => {
                  if (isMountedRef.current) {
                    console.log("Refetched tasks after realtime update:", updatedTasks.length);
                    setTasks(updatedTasks); // Update the state with newly fetched tasks
                  }
               });
               // Also refresh stats data
               fetchAllTasksForStats();
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

    // Subscribe to issues table changes for stats
    issuesChannel = supabase
      .channel('reception-issues-stats-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' },
        (payload) => {
          console.log('Issue change received for stats:', payload);
          if (isMountedRef.current) {
            fetchOpenIssuesCount();
          }
        })
      .subscribe((status, err) => {
        if (err) console.error("Issues subscription error:", err);
        else console.log("Issues subscription status:", status);
      });


    // Cleanup
    return () => {
        isMounted = false;
        console.log("Removing reception realtime channels");
        if (tasksChannel) supabase.removeChannel(tasksChannel).catch(err => console.error("Error removing tasks channel:", err));
        if (workLogChannel) supabase.removeChannel(workLogChannel).catch(err => console.error("Error removing work log channel:", err));
        if (issuesChannel) supabase.removeChannel(issuesChannel).catch(err => console.error("Error removing issues channel:", err));
    };
  // Re-run effect if any filter changes
  }, [filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId, fetchAllTasks, fetchStaff, fetchRooms, fetchTasks, fetchWorkLogs, fetchAllTasksForStats, fetchOpenIssuesCount, toast]); // Include all dependencies

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
            fetchTasks(filterDate, filterStatus, filterStaffId, filterRoomGroup, filterRoomId, fetchAllTasks),
            fetchWorkLogs(currentSelectedDate),
            fetchAllTasksForStats(), // Refresh stats data
            fetchOpenIssuesCount() // Refresh issues count
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
            if (results[4].status === 'fulfilled') {
                // fetchAllTasksForStats handles its own state update
            } else {
                console.error("Refresh failed for all tasks stats:", results[4].reason);
                refreshError = true;
            }
            if (results[5].status === 'fulfilled') {
                // fetchOpenIssuesCount handles its own state update
            } else {
                console.error("Refresh failed for open issues count:", results[5].reason);
                refreshError = true;
            }

            if (refreshError) {
                toast({ title: "Refresh Partially Failed", description: "Some data could not be refreshed.", variant: "destructive" });
            } else {
                toast({ title: "Changes saved", description: "Latest data fetched successfully." });
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
    // ** FIXED: Calculate from unfiltered tasks for accurate dashboard metrics **
    // Use allTasksForStats if available, otherwise fall back to tasks (filtered)
    const allTasks = Array.isArray(allTasksForStats) && allTasksForStats.length > 0 
      ? allTasksForStats 
      : (Array.isArray(tasks) ? tasks : []); // Fallback to filtered tasks if stats fetch failed
    const relevantDate = getTodayDateString(); // Always use today's date for 'done' count
    const today = getTodayDateString();

    console.log(`[STATS] allTasksForStats length: ${allTasksForStats.length}, tasks length: ${tasks.length}, using: ${allTasks.length}`);
    console.log(`[STATS] openIssuesCount: ${openIssuesCount}`);
    if (allTasks.length > 0) {
      console.log(`[STATS] Sample tasks:`, allTasks.slice(0, 3).map(t => ({ id: t.id, date: t.date, status: t.status })));
    } else {
      console.log(`[STATS] WARNING: Both allTasksForStats and tasks are empty!`);
    }

    // For now, let's show ALL tasks regardless of date to debug
    // Filter tasks to today and future dates for most metrics
    const currentAndFutureTasks = allTasks.filter((t) => {
      const taskDate = t.date;
      const isCurrentOrFuture = taskDate >= today;
      if (!isCurrentOrFuture && allTasks.length > 0) {
        console.log(`[STATS] Task ${t.id} excluded: date ${taskDate} < today ${today}`);
      }
      return isCurrentOrFuture;
    });

    console.log(`[STATS] Calculating stats: ${allTasks.length} total tasks fetched, ${currentAndFutureTasks.length} from today/future (${today}), date: ${relevantDate}`);

    // For debugging: if no tasks from today/future, show all tasks count temporarily
    if (currentAndFutureTasks.length === 0 && allTasks.length > 0) {
      console.log(`[STATS] WARNING: No tasks from today/future, but ${allTasks.length} total tasks exist. Today is: ${today}`);
      console.log(`[STATS] Task dates:`, allTasks.map(t => ({ date: t.date, status: t.status })).slice(0, 10));
      // TEMPORARY: Show all tasks if none from today/future (for debugging)
      const useAllTasks = allTasks.length > 0 && currentAndFutureTasks.length === 0;
      if (useAllTasks) {
        console.log(`[STATS] TEMPORARY FIX: Using all tasks instead of filtered tasks`);
        const todoCount = allTasks.filter((t) => t.status === "todo").length;
        const inProgressCount = allTasks.filter((t) => t.status === "in_progress").length;
        const doneCount = allTasks.filter((t) => t.status === "done").length;
        
        return {
          total: allTasks.length,
          todo: todoCount,
          inProgress: inProgressCount,
          done: doneCount,
          repair: openIssuesCount,
        };
      }
    }

    const todoCount = currentAndFutureTasks.filter((t) => t.status === "todo").length;
    const inProgressCount = currentAndFutureTasks.filter((t) => t.status === "in_progress").length;
    const doneCount = currentAndFutureTasks.filter((t) => t.status === "done" && t.date === relevantDate).length;

    console.log(`[STATS] Results - total: ${currentAndFutureTasks.length}, todo: ${todoCount}, inProgress: ${inProgressCount}, done: ${doneCount}, repair: ${openIssuesCount}`);

    return {
      // Total count of ALL tasks (all statuses) from today and future dates
      total: currentAndFutureTasks.length,

      // Count of ALL tasks with 'todo' status (from today and future)
      todo: todoCount,

      // Count of ALL tasks with 'in_progress' status (from today and future)
      inProgress: inProgressCount,

      // Count tasks marked 'done' for today's date
      done: doneCount,

      // Count of open issues (from issues table, not task issue_flag)
      repair: openIssuesCount,
    };
  }, [allTasksForStats, openIssuesCount]); // Recalculate when unfiltered tasks or issues count changes


  return {
    tasks, allStaff, availableRooms, workLogs, loading, refreshing,
    filters: { date: filterDate, status: filterStatus, staffId: filterStaffId, roomGroup: filterRoomGroup, roomId: filterRoomId },
    filterSetters: { setDate: setFilterDate, setStatus: setFilterStatus, setStaffId: setFilterStaffId, setRoomGroup: setFilterRoomGroup, setRoomId: setFilterRoomId, setFetchAllTasks: setFetchAllTasks },
    actions: { refresh: handleRefresh, clearFilters: handleClearFilters },
    stats,
    fetchWorkLogs // Expose fetchWorkLogs if needed by other components
  };
}
