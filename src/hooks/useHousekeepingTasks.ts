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

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let shouldSetLoading = false;
    setTasks(currentTasks => {
      shouldSetLoading = currentTasks.length === 0;
      return currentTasks;
    });

    if (shouldSetLoading) {
      setLoading(true);
    }

    const PAGE_SIZE = 1000;
    const allRows: any[] = [];
    let data: any[] | null = null;
    let error: any = null;

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: pageData, error: pageError } = await supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, guest_count, time_limit, start_time,
          pause_start, pause_stop, total_pause, stop_time, actual_time, difference,
          housekeeping_notes, reception_notes, issue_flag, issue_description, issue_photo, created_at,
          room:rooms!inner(id, name, group_type, color),
          user:users(id, name)
        `)
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (pageError) {
        error = pageError;
        break;
      }

      allRows.push(...(pageData || []));

      if ((pageData || []).length < PAGE_SIZE) {
        break;
      }
    }

    data = error ? null : allRows;

    if (error) {
      console.error("Error fetching tasks:", error);
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

      setTasks(currentTasks => {
        if (fetchedTasks.length > 0 || currentTasks.length === 0) {
          const active = fetchedTasks.find((t) => t.status === "in_progress");
          setActiveTaskId(active?.id || null);
          return fetchedTasks;
        } else {
          return currentTasks;
        }
      });
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    if (userRole !== "housekeeping" || !userId) {
      setTasks([]);
      setLoading(false);
      setActiveTaskId(null);
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

          setTasks(currentTasks => {
            if (payloadUserId === userId || !payloadUserId) {
              fetchTasks();
            }
            return currentTasks;
          });

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

  return { tasks, loading, activeTaskId, setActiveTaskId, fetchTasks };
}
