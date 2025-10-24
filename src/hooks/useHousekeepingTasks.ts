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
    if (!userId) return setLoading(false);

    setLoading(true);
    const currentISODate = new Date().toISOString().split("T")[0];

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
      .eq("date", currentISODate)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: `Failed to fetch tasks: ${error.message}`,
        variant: "destructive",
      });
      setTasks([]);
    } else {
      const fetchedTasks = (data as unknown as Task[]) || [];
      fetchedTasks.forEach(t => t.created_at = t.created_at || new Date(0).toISOString());
      setTasks(fetchedTasks);
      const active = fetchedTasks.find((t) => t.status === "in_progress");
      setActiveTaskId(active?.id || null);
    }
    setLoading(false);
  }, [userId]); // ✅ only depends on userId, not toast or loading

  // ✅ Stable effect – only runs when userId or role changes
  useEffect(() => {
    if (userRole !== "housekeeping" || !userId) {
      setTasks([]);
      setLoading(false);
      setActiveTaskId(null);
      return;
    }

    // Fetch immediately
    fetchTasks();

    // Avoid double subscriptions
    if (channelRef.current) return;

    const currentISODate = new Date().toISOString().split("T")[0];
    const channel = supabase
      .channel(`my-tasks-channel-${userId}`)
      .on<Task>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}&date=eq.${currentISODate}`,
        },
        (payload) => {
          console.log("Realtime update:", payload);
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
  }, [userId, userRole, fetchTasks, toast]);

  return { tasks, loading, activeTaskId, setActiveTaskId, fetchTasks };
}
