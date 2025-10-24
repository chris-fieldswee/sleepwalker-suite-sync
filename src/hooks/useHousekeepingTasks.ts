// src/hooks/useHousekeepingTasks.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Task } from '@/pages/Housekeeping'; // Assuming Task type is exported or moved

export function useHousekeepingTasks() {
  const { userId, userRole } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!userId) {
        setLoading(false); // Stop loading if no user ID
        return;
    }
    // console.log("Fetching tasks for user:", userId); // Debug log

    // Ensure loading is true at the start of fetch, unless already fetching
    if (!loading) setLoading(true);

    const currentISODate = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, start_time,
        pause_start, pause_stop, total_pause, stop_time, housekeeping_notes,
        reception_notes, issue_flag, issue_description, issue_photo, created_at,
        room:rooms!inner(id, name, group_type, color),
        user:users(id, name)
        // --- SCHEMA CHANGE REQUIRED: ---
        // reception_note_acknowledged, priority
      `)
      .eq("user_id", userId)
      .eq("date", currentISODate)
      // --- SCHEMA CHANGE REQUIRED for priority: ---
      // .order("priority", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching tasks:", error);
      toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" });
      setTasks([]); // Clear tasks on error
    } else {
      const fetchedTasks = (data as unknown as Task[]) || [];
      // Ensure created_at exists for sorting/display consistency
      fetchedTasks.forEach(t => t.created_at = t.created_at || new Date(0).toISOString());
      setTasks(fetchedTasks);
      // Update activeTaskId based on newly fetched tasks
      const active = fetchedTasks.find((t) => t.status === "in_progress");
      setActiveTaskId(active?.id || null);
    }
    setLoading(false); // Set loading false after fetch completes (success or error)
  }, [userId, toast, loading]); // Added loading to dependencies to prevent concurrent fetches

  // Effect for initial fetch and realtime subscription
  useEffect(() => {
    // Only run if user is housekeeping and userId is available
    if (userRole !== "housekeeping" || !userId) {
      setLoading(false); // Ensure loading is false if effect shouldn't run
      setTasks([]); // Clear tasks if role/user changes
      setActiveTaskId(null);
      return;
    }

    fetchTasks(); // Initial fetch

    const currentISODate = new Date().toISOString().split("T")[0];
    const channel = supabase
      .channel(`my-tasks-channel-${userId}`)
      .on<Task>(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}&date=eq.${currentISODate}` },
        (payload) => {
          console.log("Housekeeping Realtime update received:", payload);
          // Simple refetch strategy for now ensures UI consistency
          fetchTasks();

          // Notification Logic (keep as is)
          if (payload.eventType === 'INSERT') {
               const roomName = (payload.new as Task)?.room?.name || 'Unknown Room';
               toast({ title: "New Task Assigned", description: `Task for Room ${roomName} added.`});
           } else if (payload.eventType === 'UPDATE') {
               const oldNotes = (payload.old as Task | null)?.reception_notes;
               const newNotes = (payload.new as Task | null)?.reception_notes;
               const roomName = (payload.new as Task)?.room?.name || 'Unknown Room';
               if (newNotes && newNotes !== oldNotes) {
                   toast({ title: `Note Update for Room ${roomName}`, description: `Reception: "${newNotes}"` });
               }
           }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') console.log('Realtime channel subscribed successfully!');
        if (status === 'CHANNEL_ERROR' || err) {
            console.error("Realtime subscription error:", err || 'Channel Error');
            toast({ title: "Realtime Error", description: "Connection issue, updates might be delayed.", variant: "destructive" });
        }
        if (status === 'CLOSED') console.log('Realtime channel closed.');
        console.log("Realtime subscription status:", status);
      });

    // Cleanup
    return () => {
      console.log("Removing housekeeping realtime channel");
      supabase.removeChannel(channel).catch(err => console.error("Error removing channel:", err));
    };
  }, [userId, userRole, fetchTasks, toast]); // Dependencies updated

  // Return fetchTasks so it can be called explicitly
  return { tasks, loading, activeTaskId, setActiveTaskId, fetchTasks };
}
