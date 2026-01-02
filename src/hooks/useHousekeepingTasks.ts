import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Task } from '@/pages/Housekeeping';

export function useHousekeepingTasks() {
  const { userId, userRole } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // ✅ Use a stable ref to prevent recreating subscription logic
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchTasks = useCallback(async () => {
    // #region agent log
    const currentTasksRef = tasks.length;
    fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:17',message:'fetchTasks called',data:{userId:userId,hasTasksBefore:currentTasksRef},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!userId) return setLoading(false);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:20',message:'setLoading true BEFORE fetch',data:{userId:userId,loadingState:'setting to true'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    setLoading(true);

    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, start_time,
        pause_start, pause_stop, total_pause, stop_time, housekeeping_notes,
        reception_notes, issue_flag, issue_description, issue_photo, created_at,
        room:rooms!inner(id, name, group_type, color),
        user:users(id, name)
      `)
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:34',message:'fetch completed',data:{error:error?.message,dataLength:data?.length,hasError:!!error,taskIdsReturned:data?.map((t:any)=>t.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if (error) {
      console.error("Error fetching tasks:", error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:38',message:'fetch error - setting tasks to empty',data:{error:error.message,errorCode:error.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      toast({
        title: "Error",
        description: `Failed to fetch tasks: ${error.message}`,
        variant: "destructive",
      });
      setTasks([]);
    } else {
      const fetchedTasks = (data as unknown as Task[]) || [];
      fetchedTasks.forEach(t => t.created_at = t.created_at || new Date(0).toISOString());
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:47',message:'setTasks called with fetched data',data:{taskCount:fetchedTasks.length,taskIds:fetchedTasks.map(t=>t.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      setTasks(fetchedTasks);
      const active = fetchedTasks.find((t) => t.status === "in_progress");
      setActiveTaskId(active?.id || null);
    }
      // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:51',message:'setLoading false AFTER fetch',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    setLoading(false);
    }, [userId]); // ✅ only depends on userId, not toast or loading

  // ✅ Stable effect – only runs when userId or role changes
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:54',message:'useEffect triggered',data:{userId:userId,userRole:userRole,hasChannel:!!channelRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (userRole !== "housekeeping" || !userId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:57',message:'clearing tasks - invalid role/user',data:{userRole:userRole,userId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      setTasks([]);
      setLoading(false);
      setActiveTaskId(null);
      return;
    }

    // Fetch immediately
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:66',message:'calling fetchTasks from useEffect',data:{userId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    fetchTasks();

    // Avoid double subscriptions
    if (channelRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:69',message:'subscription already exists - skipping',data:{userId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return;
    }

    const channel = supabase
      .channel(`my-tasks-channel-${userId}`)
      .on<Task>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Realtime update:", payload);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:84',message:'realtime update received',data:{eventType:payload.eventType,taskId:payload.new?.id||payload.old?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          fetchTasks();

          if (payload.eventType === "INSERT") {
            const room = (payload.new as Task)?.room?.name || "Unknown Room";
            toast({ title: "New Task Assigned", description: `Task for Room ${room} added.` });
          } else if (payload.eventType === "UPDATE") {
            const oldNotes = (payload.old as Task)?.reception_notes;
            const newNotes = (payload.new as Task)?.reception_notes;
            const room = (payload.new as Task)?.room?.name || "Unknown Room";
            if (newNotes && newNotes !== oldNotes) {
              toast({ title: `Note Update for Room ${room}`, description: `Reception: "${newNotes}"` });
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log("Realtime subscription status:", status);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:97',message:'realtime subscription status',data:{status:status,error:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        if (err) console.error("Realtime subscription error:", err);
      });

    channelRef.current = channel;

    return () => {
      console.log("Cleaning up housekeeping channel");
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:108',message:'cleanup function called',data:{userId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
          .catch(err => console.error("Error removing channel:", err));
        channelRef.current = null;
      }
    };
  }, [userId, userRole, fetchTasks, toast]);

  return { tasks, loading, activeTaskId, setActiveTaskId, fetchTasks };
}
