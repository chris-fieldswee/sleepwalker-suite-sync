// src/pages/Reception.tsx
import { useEffect, useState, useCallback } from "react"; // Added useCallback
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
import { LogOut, Plus, RefreshCw, Clock, Edit2, Check, X } from "lucide-react"; // Added Clock, Edit2, Check, X
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

// Interfaces Task, Staff, WorkLog... (keep existing interfaces from previous step)
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

  // Filters state (keep existing)
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
      // Pre-select the first room if available and none is selected
      if (data && data.length > 0 && !newTask.roomId) {
         setNewTask(prev => ({ ...prev, roomId: data[0].id }));
      }
    }
  }, [toast, newTask.roomId]); // Include toast and newTask.roomId dependency


  // --- Fetch Staff --- (Keep existing fetchStaff)
  const fetchStaff = useCallback(async () => {
    // ... (existing fetchStaff code)
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
  }, [toast]); // Added toast dependency


  // --- Fetch Tasks --- (Keep existing fetchTasks, ensure select includes room.id and room.color)
  const fetchTasks = useCallback(async () => {
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

    // Apply filters (keep existing filter logic)
     if (filterStatus !== "all") {
      query = query.eq("status", filterStatus as any);
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
        let filteredData = data as Task[]; // Correct typing
        // Filter by room group (keep existing logic)
         if (filterRoomGroup !== "all") {
            filteredData = filteredData.filter(
            (task: Task) => task.room.group_type === filterRoomGroup
            );
        }
        setTasks(filteredData);
    }
    setLoading(false); // Ensure loading is set false even on error
  }, [filterDate, filterStatus, filterStaffId, filterRoomGroup, toast]); // Added toast dependency

   // --- Handle Refresh --- (Keep existing)
   const handleRefresh = async () => { /* ... */ };
   // --- Handle Clear Filters --- (Keep existing)
   const handleClearFilters = () => { /* ... */ };
   // --- Get Filtered Task Count --- (Keep existing)
   const getFilteredTasksCount = () => { /* ... */ };

  // --- Main useEffect for fetching data and setting up realtime ---
  useEffect(() => {
    if (userRole !== "reception" && userRole !== "admin") {
      return;
    }
    setLoading(true); // Set loading true when dependencies change
    fetchStaff();
    fetchRooms(); // Fetch rooms as well
    fetchTasks(); // Fetch tasks

    // Realtime subscription (keep existing logic + add notifications)
     const channel = supabase
      .channel("reception-tasks-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `date=eq.${filterDate}`, // Filter by date
        },
        (payload) => {
          console.log("Reception Realtime Update:", payload);
          // Refetch tasks to update the list based on current filters
          fetchTasks();

           // --- Add Notifications for Reception ---
           if (payload.eventType === 'UPDATE') {
                const oldTask = payload.old as Task;
                const newTask = payload.new as Task;

                // Check if housekeeping added/changed notes
                if (newTask.housekeeping_notes && newTask.housekeeping_notes !== oldTask?.housekeeping_notes) {
                    toast({
                        title: `Note added by staff - Room ${newTask.room?.name || 'Unknown'}`,
                        description: `"${newTask.housekeeping_notes}"`,
                        duration: 5000 // Keep notification longer
                    });
                }
                // Check if housekeeping flagged an issue
                if (newTask.issue_flag && !oldTask?.issue_flag) {
                     toast({
                        title: `Issue Reported - Room ${newTask.room?.name || 'Unknown'}`,
                        description: `${newTask.issue_description || 'No description provided.'}`,
                         variant: "destructive",
                         duration: 7000
                    });
                }
           }
        }
      )
      .subscribe((status, err) => {
         if (err) {
            console.error("Reception Realtime subscription error:", err);
            toast({ title: "Realtime Error", description: "Connection issue, try refreshing.", variant: "destructive"});
          } else {
            console.log("Reception Realtime subscription status:", status);
          }
      });


    return () => {
        console.log("Removing reception realtime channel");
        supabase.removeChannel(channel);
    };
  }, [userRole, filterDate, fetchStaff, fetchRooms, fetchTasks, toast]); // Include fetch functions and toast

  // --- Handle Add Task Submission ---
  const handleAddTask = async () => {
    if (!newTask.roomId || !newTask.cleaningType) {
        toast({ title: "Missing Information", description: "Please select a room and cleaning type.", variant: "destructive" });
        return;
    }
    setIsSubmittingTask(true);

    try {
        // 1. Find the selected room details
        const selectedRoom = availableRooms.find(r => r.id === newTask.roomId);
        if (!selectedRoom) {
            throw new Error("Selected room not found.");
        }

        // 2. Fetch the time limit from the 'limits' table
        const { data: limitData, error: limitError } = await supabase
            .from('limits')
            .select('time_limit')
            .eq('group_type', selectedRoom.group_type)
            .eq('cleaning_type', newTask.cleaningType)
            .eq('guest_count', newTask.guestCount)
            .maybeSingle(); // Use maybeSingle as a limit might not exist

        if (limitError) {
             throw new Error(`Failed to fetch time limit: ${limitError.message}`);
        }

        const timeLimit = limitData?.time_limit ?? null; // Default to null if no limit found

         // 3. Prepare task data for insertion
        const taskToInsert = {
            date: filterDate, // Use the currently filtered date
            room_id: newTask.roomId,
            cleaning_type: newTask.cleaningType,
            guest_count: newTask.guestCount,
            time_limit: timeLimit,
            reception_notes: newTask.notes || null,
            user_id: newTask.staffId === 'unassigned' ? null : newTask.staffId,
            status: 'todo' as Database["public"]["Enums"]["task_status"], // Explicitly set initial status
        };

        // 4. Insert the task
        const { error: insertError } = await supabase
            .from('tasks')
            .insert(taskToInsert);

        if (insertError) {
             throw new Error(`Failed to add task: ${insertError.message}`);
        }

        toast({ title: "Task Added Successfully" });
        setIsAddTaskModalOpen(false); // Close modal on success
        setNewTask(initialNewTaskState); // Reset form
        // fetchTasks(); // Let Realtime handle the update

    } catch (error: any) {
        console.error("Error adding task:", error);
        toast({ title: "Error Adding Task", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmittingTask(false);
    }
  };


  const stats = getFilteredTasksCount();

  return (
    <div className="min-h-screen bg-background">
      <header /* ... */ >
          {/* ... */}
           <div className="flex gap-2">
            {/* ... Refresh Button ... */}

            {/* --- Add Task Button with Dialog Trigger --- */}
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
                                    {/* You might want a mapping for user-friendly names */}
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

            {/* ... Sign Out Button ... */}
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
          {/* ... Statistics Cards ... */}
          {/* ... Filters Card ... */}
          {/* ... Tasks Table Card ... */}
            <Card>
                <CardHeader>
                    <CardTitle>Tasks for {new Date(filterDate).toLocaleDateString()}</CardTitle>
                     {/* Optional: Add Description from Card component if needed */}
                     {/* <CardDescription>Manage daily housekeeping tasks.</CardDescription> */}
                </CardHeader>
                <CardContent className="p-0">
                    {/* ... Loading / No Tasks / Table rendering ... */}
                    {loading ? (
                         <div className="flex items-center justify-center py-12">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : tasks.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-lg font-medium text-muted-foreground">No tasks found</p>
                            <p className="text-sm text-muted-foreground">Try adjusting filters or add a new task.</p>
                             {/* Maybe add a quick add button here too? */}
                             {/* <DialogTrigger asChild><Button size="sm" className="mt-4"><Plus className="mr-2 h-4 w-4" /> Add Task</Button></DialogTrigger> */}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                           {/* ... Table ... */}
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
                                     <TableHead className="font-semibold min-w-[200px]">Notes</TableHead> {/* Ensure Notes column has enough space */}
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
