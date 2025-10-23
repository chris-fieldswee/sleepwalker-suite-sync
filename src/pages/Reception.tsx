// src/pages/Reception.tsx
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Added CardDescription
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import { TaskFilters } from "@/components/reception/TaskFilters";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"; // Added Dialog components
import { Input } from "@/components/ui/input"; // Added Input
import { Label } from "@/components/ui/label"; // Added Label
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added Select components
import { Textarea } from "@/components/ui/textarea"; // Added Textarea
import { LogOut, Plus, RefreshCw, Clock, Edit2, Check, X, AlertTriangle } from "lucide-react"; // Added missing icons
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types"; // Import Database types

// Define Enums locally for easier use in the form
const cleaningTypes: Database["public"]["Enums"]["cleaning_type"][] = ["W", "P", "T", "O", "G", "S"];

interface Room {
    id: string;
    name: string;
    group_type: Database["public"]["Enums"]["room_group"];
    capacity: number;
}

interface Task {
  id: string;
  date: string;
  status: Database["public"]["Enums"]["task_status"]; // Use Enum type
  room: { id: string; name: string; group_type: string; color: string | null }; // Added id and color
  user: { id: string; name: string } | null;
  cleaning_type: Database["public"]["Enums"]["cleaning_type"]; // Use Enum type
  guest_count: number;
  time_limit: number | null; // Allow null initially
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null;
  stop_time: string | null;
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
  issue_description: string | null;
  issue_photo: string | null;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface WorkLog {
  id: string;
  user_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  total_minutes: number | null;
  break_minutes: number | null;
  notes: string | null;
  user: { name: string }; // Include user name
}

// Define the structure for the new task form state
interface NewTaskState {
    roomId: string;
    cleaningType: Database["public"]["Enums"]["cleaning_type"];
    guestCount: number;
    staffId: string | 'unassigned'; // Allow 'unassigned'
    notes: string;
}

const initialNewTaskState: NewTaskState = {
    roomId: "",
    cleaningType: "W", // Default cleaning type
    guestCount: 2,    // Default guest count
    staffId: "unassigned",
    notes: "",
};


export default function Reception() {
  const { signOut, userRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]); // State for rooms dropdown
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false); // State for Add Task modal
  const [newTask, setNewTask] = useState<NewTaskState>(initialNewTaskState); // State for new task form data
  const [isSubmittingTask, setIsSubmittingTask] = useState(false); // Loading state for task submission

  // Work Log State
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [editingLog, setEditingLog] = useState<Partial<WorkLog> & { user_id: string } | null>(null); // Ensure user_id is present when editing
  const [isWorkLogModalOpen, setIsWorkLogModalOpen] = useState(false);


  // Filters state
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStaffId, setFilterStaffId] = useState("all");
  const [filterRoomGroup, setFilterRoomGroup] = useState("all");

  const { toast } = useToast();

   // --- Fetch Rooms ---
   const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from("rooms")
      .select("id, name, group_type, capacity")
      .eq("active", true) // Only fetch active rooms
      .order("name");

    if (error) {
      console.error("Error fetching rooms:", error);
      toast({ title: "Error", description: "Could not load rooms.", variant: "destructive" });
    } else {
      setAvailableRooms(data || []);
      // Pre-select the first room if available and none is selected in the modal
      if (data && data.length > 0 && !newTask.roomId) {
         setNewTask(prev => ({ ...prev, roomId: data[0].id }));
      }
    }
  }, [toast, newTask.roomId]);


  // --- Fetch Staff ---
  const fetchStaff = useCallback(async () => {
     const { data, error } = await supabase
      .from("users")
      .select("id, name, role")
      .eq("role", "housekeeping")
      .eq("active", true)
      .order("name");

    if (!error && data) {
      setAllStaff(data);
    } else if (error) {
        console.error("Error fetching staff:", error);
        toast({ title: "Error", description: "Failed to fetch staff list.", variant: "destructive"});
    }
  }, [toast]);


  // --- Fetch Tasks ---
  const fetchTasks = useCallback(async () => {
     // setLoading(true); // Keep loading state for initial load or manual refresh
     let query = supabase
      .from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, actual_time, difference,
        issue_flag, housekeeping_notes, reception_notes, start_time, stop_time,
        pause_start, pause_stop, total_pause, issue_description, issue_photo,
        room:rooms!inner(id, name, group_type, color),
        user:users(id, name)
      `)
      .eq("date", filterDate)
      .order("created_at", { ascending: true });

    // Apply filters
     if (filterStatus !== "all") {
      query = query.eq("status", filterStatus as Database["public"]["Enums"]["task_status"]);
    }
    if (filterStaffId !== "all") {
      if (filterStaffId === "unassigned") {
        query = query.is("user_id", null);
      } else {
        query = query.eq("user_id", filterStaffId);
      }
    }

    const { data, error } = await query;

    if (error) {
        console.error("Error fetching tasks:", error);
        toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" });
        setTasks([]);
    } else {
        let filteredData = data as Task[];
        // Filter by room group
         if (filterRoomGroup !== "all") {
            filteredData = filteredData.filter(
            (task: Task) => task.room.group_type === filterRoomGroup
            );
        }
        setTasks(filteredData);
    }
    setLoading(false);
  }, [filterDate, filterStatus, filterStaffId, filterRoomGroup, toast]);

    // --- Fetch Work Logs ---
  const fetchWorkLogs = useCallback(async () => {
    if (!filterDate) return;
    const { data, error } = await supabase
      .from("work_logs")
      .select(`
        id, user_id, date, time_in, time_out, total_minutes,
        break_minutes, notes, user:users!inner(name)
      `) // Use !inner join to ensure user name is present
      .eq("date", filterDate);

    if (error) {
      console.error("Error fetching work logs:", error);
      toast({ title: "Error", description: "Failed to fetch work logs.", variant: "destructive" });
      setWorkLogs([]);
    } else {
      // Ensure data is correctly typed or cast
      setWorkLogs((data as unknown as WorkLog[]) || []);
    }
  }, [filterDate, toast]);

  // --- Handle Refresh ---
   const handleRefresh = async () => {
        setRefreshing(true);
        setLoading(true); // Show loading indicator during refresh
        await Promise.all([fetchTasks(), fetchWorkLogs(), fetchStaff(), fetchRooms()]); // Refresh all data
        setLoading(false);
        setTimeout(() => setRefreshing(false), 500);
        toast({ title: "Data refreshed" });
    };

   // --- Handle Clear Filters ---
   const handleClearFilters = () => {
        setFilterDate(new Date().toISOString().split("T")[0]);
        setFilterStatus("all");
        setFilterStaffId("all");
        setFilterRoomGroup("all");
        // fetchTasks will be triggered by useEffect due to filterDate change
    };

    // --- Get Filtered Task Count ---
   const getFilteredTasksCount = () => {
        return {
        total: tasks.length,
        todo: tasks.filter((t) => t.status === "todo").length,
        inProgress: tasks.filter((t) => t.status === "in_progress").length,
        done: tasks.filter((t) => t.status === "done").length,
        repair: tasks.filter((t) => t.issue_flag).length,
        };
    };

    // --- Handle Save Work Log ---
   const handleSaveWorkLog = async () => {
    if (!editingLog || !editingLog.user_id || !filterDate) return;

    // Convert empty strings to null for time inputs
    const timeIn = editingLog.time_in?.trim() ? editingLog.time_in : null;
    const timeOut = editingLog.time_out?.trim() ? editingLog.time_out : null;

    // Ensure break_minutes is a number or 0
    const breakMinutes = Number.isFinite(editingLog.break_minutes) ? editingLog.break_minutes : 0;

    const logData = {
      user_id: editingLog.user_id,
      date: filterDate,
      time_in: timeIn ? `${filterDate}T${timeIn}:00` : null, // Add seconds for TIMESTAMPTZ
      time_out: timeOut ? `${filterDate}T${timeOut}:00` : null, // Add seconds for TIMESTAMPTZ
      break_minutes: breakMinutes,
      notes: editingLog.notes || null,
    };

    let error;
    // Use upsert to handle both insert and update based on unique constraint (user_id, date)
    ({ error } = await supabase.from("work_logs").upsert(logData, { onConflict: 'user_id, date' }));


    if (error) {
      console.error("Error saving work log:", error);
      toast({ title: "Error", description: `Failed to save work log: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Work log saved" });
      setEditingLog(null); // Exit editing mode for this row
      // No explicit fetch needed, rely on realtime
    }
  };

    // Helper to format time from TIMESTAMPTZ for input type="time"
    const formatTimeForInput = (dateTimeString: string | null | undefined): string => {
        if (!dateTimeString) return "";
        try {
            const date = new Date(dateTimeString);
            if (isNaN(date.getTime())) return ""; // Check for invalid date
            // Format as HH:MM
             const hours = date.getHours().toString().padStart(2, '0');
             const minutes = date.getMinutes().toString().padStart(2, '0');
             return `${hours}:${minutes}`;
        } catch (e) {
            console.error("Error formatting time:", e);
            return ""; // Handle errors during parsing/formatting
        }
    };

  // --- Main useEffect for fetching data and setting up realtime ---
  useEffect(() => {
    if (userRole !== "reception" && userRole !== "admin") {
      setLoading(false); // Stop loading if wrong role
      return;
    }
    setLoading(true); // Set loading when dependencies change
    // Fetch initial data
    Promise.all([
        fetchStaff(),
        fetchRooms(),
        fetchTasks(),
        fetchWorkLogs() // Fetch initial work logs too
    ]).then(() => {
        setLoading(false); // Set loading false after all initial fetches complete
    }).catch(() => {
        setLoading(false); // Ensure loading is false even if initial fetch fails
    });


    // --- Realtime Subscriptions ---

    // Tasks Channel
    const tasksChannel = supabase
      .channel("reception-tasks-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `date=eq.${filterDate}`, // Filter by date relevant to the view
        },
        (payload) => {
          console.log("Reception Task Update:", payload);
          fetchTasks(); // Refetch tasks to apply current UI filters

           // --- Add Notifications for Reception ---
           if (payload.eventType === 'UPDATE') {
                const oldTask = payload.old as Task | null; // Allow null
                const newTask = payload.new as Task | null; // Allow null

                // Check if housekeeping added/changed notes (ensure newTask exists)
                if (newTask && newTask.housekeeping_notes && newTask.housekeeping_notes !== oldTask?.housekeeping_notes) {
                    toast({
                        title: `Note added - Room ${newTask.room?.name || 'Unknown'}`,
                        description: `"${newTask.housekeeping_notes}"`,
                        duration: 5000
                    });
                }
                // Check if housekeeping flagged an issue (ensure newTask exists)
                if (newTask && newTask.issue_flag && !oldTask?.issue_flag) {
                     toast({
                        title: `Issue Reported - Room ${newTask.room?.name || 'Unknown'}`,
                        description: `${newTask.issue_description || 'No description.'}`,
                         variant: "destructive",
                         duration: 7000
                    });
                }
           }
        }
      )
      .subscribe((status, err) => {
         if (err) {
            console.error("Reception Tasks Realtime error:", err);
            toast({ title: "Task Sync Error", description: "Connection issue, try refreshing.", variant: "destructive"});
          } else {
            console.log("Reception Tasks Realtime status:", status);
          }
      });

      // Work Logs Channel
      const workLogChannel = supabase
        .channel('reception-work-logs-channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'work_logs',
          filter: `date=eq.${filterDate}` // Filter by date
        }, (payload) => {
          console.log('Work log change received:', payload);
          fetchWorkLogs(); // Refetch logs on change
        })
        .subscribe((status, err) => {
           if (err) {
              console.error("Work Log Realtime error:", err);
              toast({ title: "Work Log Sync Error", description: "Could not sync work logs.", variant: "destructive"});
            } else {
              console.log("Work Log Realtime status:", status);
            }
        });


    return () => {
        console.log("Removing reception realtime channels");
        supabase.removeChannel(tasksChannel);
        supabase.removeChannel(workLogChannel);
    };
     // Rerun effect if relevant filters change
  }, [userRole, filterDate, fetchStaff, fetchRooms, fetchTasks, fetchWorkLogs, toast]);


  // --- Handle Add Task Submission ---
  const handleAddTask = async () => {
    if (!newTask.roomId || !newTask.cleaningType) {
        toast({ title: "Missing Information", description: "Please select a room and cleaning type.", variant: "destructive" });
        return;
    }
    setIsSubmittingTask(true);

    try {
        const selectedRoom = availableRooms.find(r => r.id === newTask.roomId);
        if (!selectedRoom) throw new Error("Selected room not found.");

        const { data: limitData, error: limitError } = await supabase
            .from('limits')
            .select('time_limit')
            .eq('group_type', selectedRoom.group_type)
            .eq('cleaning_type', newTask.cleaningType)
            .eq('guest_count', newTask.guestCount)
            .maybeSingle();

        if (limitError) throw new Error(`Failed to fetch time limit: ${limitError.message}`);
        const timeLimit = limitData?.time_limit ?? null;

        const taskToInsert: Omit<Database["public"]["Tables"]["tasks"]["Insert"], 'id' | 'created_at' | 'updated_at'> = {
            date: filterDate,
            room_id: newTask.roomId,
            cleaning_type: newTask.cleaningType,
            guest_count: newTask.guestCount,
            time_limit: timeLimit,
            reception_notes: newTask.notes || null,
            user_id: newTask.staffId === 'unassigned' ? null : newTask.staffId,
            status: 'todo',
            // Set defaults explicitly to null where applicable if needed
            start_time: null,
            stop_time: null,
            pause_start: null,
            pause_stop: null,
            total_pause: 0,
            actual_time: null,
            difference: null,
            issue_flag: false,
            issue_description: null,
            issue_photo: null,
            housekeeping_notes: null,
        };

        const { error: insertError } = await supabase.from('tasks').insert(taskToInsert);
        if (insertError) throw new Error(`Failed to add task: ${insertError.message}`);

        toast({ title: "Task Added Successfully" });
        setIsAddTaskModalOpen(false);
        setNewTask(initialNewTaskState);
        // Realtime should trigger fetchTasks

    } catch (error: any) {
        console.error("Error adding task:", error);
        toast({ title: "Error Adding Task", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmittingTask(false);
    }
  };


  const stats = getFilteredTasksCount();

  // --- JSX ---
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Reception Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Housekeeping Operations Management
            </p>
          </div>
          <div className="flex gap-2">
            {/* Refresh Button */}
             <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || loading} // Disable when loading too
            >
                <RefreshCw
                className={`mr-2 h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} // Spin when loading
                />
                Refresh
            </Button>

            {/* Work Logs Modal Trigger */}
             <Dialog open={isWorkLogModalOpen} onOpenChange={setIsWorkLogModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Clock className="mr-2 h-4 w-4" /> Work Logs
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[650px] md:max-w-[750px] lg:max-w-[900px]"> {/* Wider modal */}
                      <DialogHeader>
                        <DialogTitle>Staff Work Logs for {new Date(filterDate).toLocaleDateString()}</DialogTitle>
                        <DialogDescription>
                            Enter or update staff sign-in/out times, breaks, and notes.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="mt-4 max-h-[60vh] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[150px]">Staff</TableHead> {/* Fixed width */}
                              <TableHead className="w-[120px]">Time In</TableHead>
                              <TableHead className="w-[120px]">Time Out</TableHead>
                              <TableHead className="w-[100px]">Break (min)</TableHead>
                              <TableHead>Notes</TableHead> {/* Flexible width */}
                              <TableHead className="w-[100px]">Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allStaff.map((staffMember) => {
                              const log = workLogs.find(l => l.user_id === staffMember.id);
                              const isEditing = editingLog?.user_id === staffMember.id;
                              // Use editingLog if editing, otherwise use fetched log or defaults
                              const displayLog = isEditing ? editingLog : {
                                    id: log?.id,
                                    user_id: staffMember.id, // Always ensure user_id is set
                                    time_in: formatTimeForInput(log?.time_in),
                                    time_out: formatTimeForInput(log?.time_out),
                                    break_minutes: log?.break_minutes ?? 0,
                                    notes: log?.notes ?? "",
                                };

                              return (
                                <TableRow key={staffMember.id}>
                                  <TableCell className="font-medium">{staffMember.name}</TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <Input
                                        type="time"
                                        value={displayLog.time_in || ""}
                                        onChange={(e) => setEditingLog({...displayLog, time_in: e.target.value})}
                                        className="w-full" // Use full width of cell
                                      />
                                    ) : (
                                       displayLog.time_in || "-"
                                    )}
                                  </TableCell>
                                   <TableCell>
                                    {isEditing ? (
                                      <Input
                                        type="time"
                                        value={displayLog.time_out || ""}
                                        onChange={(e) => setEditingLog({...displayLog, time_out: e.target.value})}
                                         className="w-full"
                                      />
                                    ) : (
                                       displayLog.time_out || "-"
                                    )}
                                  </TableCell>
                                   <TableCell>
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        value={displayLog.break_minutes ?? 0}
                                        onChange={(e) => setEditingLog({...displayLog, break_minutes: parseInt(e.target.value, 10) || 0})}
                                        min="0"
                                        className="w-full"
                                      />
                                    ) : (
                                       displayLog.break_minutes ?? 0
                                    )}
                                  </TableCell>
                                   <TableCell>
                                    {isEditing ? (
                                      <Input
                                        type="text"
                                        value={displayLog.notes || ""}
                                        onChange={(e) => setEditingLog({...displayLog, notes: e.target.value})}
                                        className="w-full"
                                      />
                                    ) : (
                                      <span className="text-xs">{displayLog.notes || "-"}</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {isEditing ? (
                                      <div className="flex gap-1 justify-center">
                                         <Button size="icon" className="h-8 w-8" onClick={handleSaveWorkLog}><Check className="h-4 w-4"/></Button>
                                         <Button size="icon" className="h-8 w-8" variant="outline" onClick={() => setEditingLog(null)}><X className="h-4 w-4"/></Button>
                                      </div>
                                    ) : (
                                      <Button
                                         size="icon"
                                         className="h-8 w-8 mx-auto" // Center button
                                         variant="ghost"
                                         onClick={() => setEditingLog({ // Set state based on displayLog defaults
                                            id: displayLog.id,
                                            user_id: displayLog.user_id,
                                            time_in: displayLog.time_in,
                                            time_out: displayLog.time_out,
                                            break_minutes: displayLog.break_minutes,
                                            notes: displayLog.notes,
                                        })}
                                      >
                                        <Edit2 className="h-4 w-4"/>
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <DialogFooter>
                         <DialogClose asChild>
                           <Button type="button" variant="secondary">Close</Button>
                          </DialogClose>
                      </DialogFooter>
                  </DialogContent>
             </Dialog>


            {/* Add Task Modal Trigger */}
             <Dialog open={isAddTaskModalOpen} onOpenChange={(isOpen) => {
                 setIsAddTaskModalOpen(isOpen);
                 if (!isOpen) setNewTask(initialNewTaskState); // Reset form on close
              }}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Task
                    </Button>
                </DialogTrigger>
                 <DialogContent className="sm:max-w-[480px]">
                      <DialogHeader>
                        <DialogTitle>Add New Cleaning Task</DialogTitle>
                        <DialogDescription>
                           Select room, cleaning type, guests, and assign staff.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                       {/* Room Select */}
                       <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="room" className="text-right">Room*</Label>
                         <Select
                            value={newTask.roomId}
                            onValueChange={(value) => setNewTask(prev => ({ ...prev, roomId: value }))}
                         >
                            <SelectTrigger id="room" className="col-span-3">
                                <SelectValue placeholder="Select a room" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableRooms.length > 0 ? availableRooms.map(room => (
                                <SelectItem key={room.id} value={room.id}>
                                    {room.name}
                                </SelectItem>
                                )) : <SelectItem value="loading" disabled>Loading rooms...</SelectItem>}
                            </SelectContent>
                         </Select>
                       </div>
                       {/* Cleaning Type Select */}
                       <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="cleaningType" className="text-right">Type*</Label>
                         <Select
                            value={newTask.cleaningType}
                             onValueChange={(value: Database["public"]["Enums"]["cleaning_type"]) => setNewTask(prev => ({ ...prev, cleaningType: value }))}
                         >
                            <SelectTrigger id="cleaningType" className="col-span-3">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {cleaningTypes.map(type => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                                ))}
                            </SelectContent>
                         </Select>
                       </div>
                       {/* Guest Count Input */}
                       <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="guestCount" className="text-right">Guests*</Label>
                            <Input
                                id="guestCount"
                                type="number"
                                min="1"
                                value={newTask.guestCount}
                                onChange={(e) => setNewTask(prev => ({ ...prev, guestCount: parseInt(e.target.value, 10) || 1 }))}
                                className="col-span-3"
                                required
                            />
                        </div>
                       {/* Staff Select */}
                       <div className="grid grid-cols-4 items-center gap-4">
                         <Label htmlFor="assignStaff" className="text-right">Assign Staff</Label>
                         <Select
                            value={newTask.staffId}
                            onValueChange={(value) => setNewTask(prev => ({ ...prev, staffId: value }))}
                         >
                            <SelectTrigger id="assignStaff" className="col-span-3">
                                <SelectValue placeholder="Select staff or leave unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {allStaff.map(staff => (
                                <SelectItem key={staff.id} value={staff.id}>
                                    {staff.name}
                                </SelectItem>
                                ))}
                            </SelectContent>
                         </Select>
                       </div>
                       {/* Reception Notes Textarea */}
                       <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="notes" className="text-right">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Optional notes for housekeeping..."
                                value={newTask.notes}
                                onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                                className="col-span-3 min-h-[60px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                       <DialogClose asChild>
                           <Button type="button" variant="outline" disabled={isSubmittingTask}>Cancel</Button>
                       </DialogClose>
                        <Button type="button" onClick={handleAddTask} disabled={isSubmittingTask || !newTask.roomId}>
                           {isSubmittingTask ? "Adding..." : "Add Task"}
                        </Button>
                    </DialogFooter>
                 </DialogContent>
            </Dialog>

            {/* Sign Out Button */}
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {/* Statistics Cards */}
         <div className="grid gap-4 md:grid-cols-5 mb-6">
            <Card>
                <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Tasks
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    To Clean
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold text-status-todo">
                    {stats.todo}
                </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    In Progress
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold text-status-in-progress">
                    {stats.inProgress}
                </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Completed
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold text-status-done">
                    {stats.done}
                </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    Issues
                </CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-2xl font-bold text-status-repair">
                    {stats.repair}
                </div>
                </CardContent>
            </Card>
         </div>

        {/* Filters */}
        <Card className="mb-4">
            <CardHeader>
                <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
                <TaskFilters
                date={filterDate}
                status={filterStatus}
                staffId={filterStaffId}
                roomGroup={filterRoomGroup}
                staff={allStaff}
                onDateChange={setFilterDate}
                onStatusChange={setFilterStatus}
                onStaffChange={setFilterStaffId}
                onRoomGroupChange={setFilterRoomGroup}
                onClearFilters={handleClearFilters}
                />
            </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card>
             <CardHeader>
                <CardTitle>Tasks for {new Date(filterDate).toLocaleDateString()}</CardTitle>
             </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-lg font-medium text-muted-foreground">No tasks found</p>
                        <p className="text-sm text-muted-foreground">Try adjusting filters or add a new task.</p>
                         <DialogTrigger asChild>
                           <Button size="sm" className="mt-4"><Plus className="mr-2 h-4 w-4" /> Add Task</Button>
                         </DialogTrigger>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                             <TableHeader>
                                 <TableRow className="bg-muted/50">
                                     <TableHead className="font-semibold">Status</TableHead>
                                     <TableHead className="font-semibold">Room</TableHead>
                                     <TableHead className="font-semibold">Staff</TableHead>
                                     <TableHead className="font-semibold">Type</TableHead>
                                     <TableHead className="font-semibold text-center">Guests</TableHead>
                                     <TableHead className="font-semibold text-center">Limit (min)</TableHead>
                                     <TableHead className="font-semibold text-center">Actual (min)</TableHead>
                                     <TableHead className="font-semibold text-center">Diff (min)</TableHead>
                                     <TableHead className="font-semibold text-center">Issue</TableHead>
                                     <TableHead className="font-semibold min-w-[200px]">Notes</TableHead>
                                     <TableHead className="font-semibold text-center">Working Time</TableHead>
                                 </TableRow>
                             </TableHeader>
                            <TableBody>
                                {tasks.map((task) => (
                                <TaskTableRow
                                    key={task.id}
                                    task={task}
                                    staff={allStaff}
                                />
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
