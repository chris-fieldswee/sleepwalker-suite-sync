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
    fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:17',message:'fetchTasks entry',data:{userId:userId,userRole:userRole},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!userId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:18',message:'fetchTasks early return - no userId',data:{userId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      setLoading(false);
      return;
    }

    // Use functional update to check current state without stale closure
    let shouldSetLoading = false;
    setTasks(currentTasks => {
      // #region agent log
      const currentTasksRef = currentTasks.length;
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:17',message:'fetchTasks called',data:{userId:userId,hasTasksBefore:currentTasksRef},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // Only set loading=true if we don't have tasks yet (initial load)
      // If we already have tasks, keep showing them during refresh (optimistic UI)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:20',message:'setLoading true BEFORE fetch - only if no tasks',data:{userId:userId,hasExistingTasks:currentTasks.length>0,willSetLoading:currentTasks.length===0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      shouldSetLoading = currentTasks.length === 0;
      return currentTasks; // Return unchanged for now
    });

    if (shouldSetLoading) {
      setLoading(true);
    }

    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, start_time,
        pause_start, pause_stop, total_pause, stop_time, actual_time, difference,
        housekeeping_notes, reception_notes, issue_flag, issue_description, issue_photo, created_at,
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
      setLoading(false);
    } else {
      const fetchedTasks = (data as unknown as Task[]) || [];
      fetchedTasks.forEach(t => t.created_at = t.created_at || new Date(0).toISOString());
      
      // Use functional update to check current state
      setTasks(currentTasks => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:47',message:'setTasks called with fetched data',data:{taskCount:fetchedTasks.length,taskIds:fetchedTasks.map(t=>t.id),hadTasksBefore:currentTasks.length>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // Only update tasks if we got results, or if this is the initial load (no existing tasks)
        // This prevents clearing tasks on transient query issues
        if (fetchedTasks.length > 0 || currentTasks.length === 0) {
          const active = fetchedTasks.find((t) => t.status === "in_progress");
          setActiveTaskId(active?.id || null);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:51',message:'setLoading false AFTER fetch',data:{finalTaskCount:fetchedTasks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          return fetchedTasks;
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:66',message:'skipping setTasks - empty result but had existing tasks',data:{fetchedCount:fetchedTasks.length,existingCount:currentTasks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:51',message:'setLoading false AFTER fetch (skipped update)',data:{finalTaskCount:currentTasks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          return currentTasks;
        }
      });
      setLoading(false);
    }
  }, [userId, toast]); // Keep toast - useToast should return stable reference

  // ✅ Stable effect – only runs when userId or role changes
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:105',message:'useEffect triggered',data:{userId:userId,userRole:userRole,hasChannel:!!channelRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // #region agent log
    setTasks(currentTasks => {
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:109',message:'useEffect guard check - BEFORE clearing',data:{userRole:userRole,userId:userId,currentTaskCount:currentTasks.length,willClear:userRole !== "housekeeping" || !userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
      return currentTasks;
    });
    // #endregion
    if (userRole !== "housekeeping" || !userId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:112',message:'CLEARING TASKS - invalid role/user',data:{userRole:userRole,userId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'C'})}).catch(()=>{});
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
          // Realtime payload contains raw database row, which has user_id
          const payloadNew = payload.new as any;
          const payloadOld = payload.old as any;
          const payloadUserId = payloadNew?.user_id || payloadOld?.user_id;
          const taskId = payloadNew?.id || payloadOld?.id;
          
          setTasks(currentTasks => {
            const currentTaskCount = currentTasks.length;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:115',message:'realtime update received',data:{eventType:payload.eventType,taskId:taskId,payloadUserId:payloadUserId,currentUserId:userId,matchesUser:payloadUserId===userId,currentTaskCount:currentTaskCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            // Only refetch if this update is for our user's tasks
            if (payloadUserId === userId || !payloadUserId) {
              fetchTasks();
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useHousekeepingTasks.ts:121',message:'skipping fetchTasks - different user',data:{payloadUserId:payloadUserId,currentUserId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
            }
            return currentTasks; // Don't modify state here, fetchTasks will handle it
          });

          if (payload.eventType === "INSERT") {
            // For INSERT, we need to refetch to get full task data with relations
            const roomName = payloadNew?.room_id ? "Unknown Room" : "Unknown Room"; // Will be fetched properly
            toast({ title: "New Task Assigned", description: `New task assigned to you.` });
          } else if (payload.eventType === "UPDATE") {
            // For UPDATE, check if reception notes changed
            const oldNotes = payloadOld?.reception_notes;
            const newNotes = payloadNew?.reception_notes;
            if (newNotes && newNotes !== oldNotes) {
              toast({ title: `Note Update`, description: `Reception: "${newNotes}"` });
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
  }, [userId, userRole, fetchTasks]); // Remove toast from dependencies - fetchTasks is already stable

  return { tasks, loading, activeTaskId, setActiveTaskId, fetchTasks };
}
