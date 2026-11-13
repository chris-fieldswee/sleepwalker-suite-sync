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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Each fetch takes a sequence number; only the latest one may write state, so a
  // slow, older response can never overwrite a newer one.
  const requestSeqRef = useRef(0);
  const hasTasksRef = useRef(false);

  const fetchTasks = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;

    if (!hasTasksRef.current) {
      setLoading(true);
    }

    const PAGE_SIZE = 1000;
    const BASE_COLUMNS = `
      id, date, status, cleaning_type, guest_count, time_limit, start_time,
      pause_start, pause_stop, total_pause, stop_time, actual_time, difference,
      housekeeping_notes, reception_notes, issue_flag, issue_description, issue_photo, created_at,
      room:rooms!inner(id, name, group_type, color),
      user:users(id, name)
    `;
    // supabase-js strips unquoted whitespace from the select list before sending,
    // so the layout here is purely for readability.
    const TASK_COLUMNS = `ready_to_clean, ${BASE_COLUMNS}`;

    const fetchAllPages = async (select: string): Promise<{ data: any[] | null; error: any }> => {
      const rows: any[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data: pageData, error: pageError } = await supabase
          .from("tasks")
          .select(select)
          .eq("user_id", userId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (pageError) return { data: null, error: pageError };

        rows.push(...(pageData || []));

        if ((pageData || []).length < PAGE_SIZE) break;
      }
      return { data: rows, error: null };
    };

    let { data, error } = await fetchAllPages(TASK_COLUMNS);

    // Graceful fallback: if the ready_to_clean column doesn't exist yet (migration
    // pending), retry without it so the list keeps working.
    if (error?.message?.includes('ready_to_clean')) {
      console.warn('ready_to_clean column not found — apply migration 20260815000000_add_ready_to_clean_to_tasks.sql in the Supabase dashboard SQL editor.');
      ({ data, error } = await fetchAllPages(BASE_COLUMNS));
    }

    // A newer fetch started while this one was in flight: drop this result.
    if (seq !== requestSeqRef.current) {
      return;
    }

    if (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: `Failed to fetch tasks: ${error.message}`,
        variant: "destructive",
      });
      // Keep whatever is on screen; lastUpdated is not advanced, so the
      // "last updated" time shows the list may be out of date.
      setLoading(false);
      return;
    }

    const fetchedTasks = (data as unknown as Task[]) || [];
    fetchedTasks.forEach(t => t.created_at = t.created_at || new Date(0).toISOString());

    // The server is the source of truth: an empty response clears the list.
    hasTasksRef.current = fetchedTasks.length > 0;
    setTasks(fetchedTasks);
    const active = fetchedTasks.find((t) => t.status === "in_progress");
    setActiveTaskId(active?.id || null);
    setLastUpdated(new Date());
    setLoading(false);
  }, [userId, toast]);

  // Realtime callback is registered once per channel; read the latest fetchTasks via a ref.
  const fetchTasksRef = useRef(fetchTasks);
  useEffect(() => {
    fetchTasksRef.current = fetchTasks;
  }, [fetchTasks]);

  useEffect(() => {
    if (userRole !== "housekeeping" || !userId) {
      requestSeqRef.current++;
      hasTasksRef.current = false;
      setTasks([]);
      setLoading(false);
      setActiveTaskId(null);
      setLastUpdated(null);
      return;
    }

    fetchTasks();

    if (channelRef.current) {
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
          const payloadNew = payload.new as any;
          const payloadOld = payload.old as any;
          const payloadUserId = payloadNew?.user_id || payloadOld?.user_id;

          if (payloadUserId === userId || !payloadUserId) {
            fetchTasksRef.current();
          }

          if (payload.eventType === "INSERT") {
            toast({ title: "New Task Assigned", description: `New task assigned to you.` });
          } else if (payload.eventType === "UPDATE") {
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
        if (err) console.error("Realtime subscription error:", err);
      });

    channelRef.current = channel;

    return () => {
      console.log("Cleaning up housekeeping channel");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
          .catch(err => console.error("Error removing channel:", err));
        channelRef.current = null;
      }
    };
  }, [userId, userRole, fetchTasks]);

  // A phone app can sit in the background for hours or days, and realtime events
  // missed while suspended are never replayed. Re-fetch whenever the app comes back
  // to the foreground or the connection returns.
  useEffect(() => {
    if (userRole !== "housekeeping" || !userId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchTasks();
      }
    };
    const handleOnline = () => {
      fetchTasks();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [userId, userRole, fetchTasks]);

  return { tasks, loading, activeTaskId, setActiveTaskId, fetchTasks, lastUpdated };
}
