// src/pages/reception/Archive.tsx
import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import { TaskDetailDialog } from "@/components/reception/TaskDetailDialog"; // Import the detail dialog
import type { Database } from "@/integrations/supabase/types";
import type { Staff, Room } from "@/hooks/useReceptionData"; // Import Staff and Room types

// Keep Task type consistent (you might want to centralize this type)
type Task = {
  id: string;
  date: string;
  status: string; // Keep as string if TaskTableRow uses string status
  room: { id: string; name: string; group_type: string; color: string | null };
  user: { id: string; name: string } | null;
  cleaning_type: Database["public"]["Enums"]["cleaning_type"];
  guest_count: number;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  issue_description: string | null;
  issue_photo: string | null;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null;
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
  stop_time: string | null;
  created_at?: string;
};

// Interface for props received from Reception.tsx
interface ArchiveProps {
  allStaff: Staff[];
  availableRooms: Room[];
  onUpdateTask: (taskId: string, updates: any) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<boolean>;
  isUpdatingTask: boolean;
  isDeletingTask: boolean;
}

export default function Archive({
  allStaff,
  availableRooms,
  onUpdateTask,
  onDeleteTask,
  isUpdatingTask,
  isDeletingTask
}: ArchiveProps) {
  const { toast } = useToast();
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // State for Task Detail Dialog
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Fetch tasks when date range changes
  const fetchArchivedTasks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, guest_count, time_limit, actual_time,
          difference, issue_flag, housekeeping_notes, reception_notes, start_time,
          stop_time, issue_description, issue_photo, pause_start, pause_stop, total_pause, created_at,
          room:rooms!inner(id, name, color, group_type),
          user:users(id, name, first_name, last_name)
        `)
        // Filter for done tasks OR tasks older than today (adjust logic as needed)
        // This example keeps only 'done' tasks as per original logic.
        .eq("status", "done")
        .order("date", { ascending: false })
        .order("stop_time", { ascending: false })
        .limit(500); // Consider pagination for very large archives

      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

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

      setArchivedTasks(tasksWithDisplayNames);
    } catch (error: any) {
      console.error("Error fetching archived tasks:", error);
      toast({
        title: "Error Loading Archive",
        description: "Failed to load archived tasks.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]); // Include toast in dependency array

  useEffect(() => {
    fetchArchivedTasks();
  }, [fetchArchivedTasks]); // Run fetch on mount and when fetch function changes

  // Handler to open the detail dialog
  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
    setIsDetailDialogOpen(true);
  };

  // Handler for deleting task (closes dialog if the selected task is deleted)
  const handleDelete = async (taskId: string) => {
    const success = await onDeleteTask(taskId);
    if (success) {
      // Refetch tasks to update the list
      fetchArchivedTasks();
      // Close dialog if the deleted task was the one being viewed
      if (selectedTask?.id === taskId) {
        setIsDetailDialogOpen(false);
        setSelectedTask(null);
      }
    }
  };

  const formatDate = (dateString: string) => {
    // ... (keep existing formatDate) ...
    try {
        const date = new Date(dateString + 'T00:00:00'); // Parse as local date
        if (isNaN(date.getTime())) return dateString;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}`;
    } catch (error) {
        console.error("Date formatting error:", error, dateString);
        return dateString;
    }
  };

  // Split tasks into groups
  const regularTasks = archivedTasks.filter(task => task.room.group_type !== 'OTHER');
  const otherTasks = archivedTasks.filter(task => task.room.group_type === 'OTHER');

  // Reusable function to render the table for a task list
  const renderTaskTable = (taskList: Task[], emptyMessage: string) => (
    loading ? (
       // ... (keep existing loading indicator) ...
       <div className="flex items-center justify-center py-12">
         <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
         <span className="ml-2">Loading archived tasks...</span>
       </div>
    ) : taskList.length === 0 ? (
       // ... (keep existing empty state) ...
       <div className="flex flex-col items-center justify-center py-12 text-center">
         <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
         <p className="text-sm text-muted-foreground">Adjust the date range to see more results</p>
       </div>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
             {/* ... (keep existing table header) ... */}
             <TableRow className="bg-muted/50">
               <TableHead className="w-[100px]">Status</TableHead>
               <TableHead>Room</TableHead>
               <TableHead>Staff</TableHead>
               <TableHead className="text-center w-[80px]">Type</TableHead>
               <TableHead className="text-center w-[100px]">Guests</TableHead>
               <TableHead className="text-center w-[60px]">Limit</TableHead>
               <TableHead className="text-center w-[60px]">Actual</TableHead>
               <TableHead className="text-center w-[60px]">Issue</TableHead>
               <TableHead className="text-center w-[60px]">Notes</TableHead>
               <TableHead className="text-right w-[100px]">Actions</TableHead>
             </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map((task) => (
              <TaskTableRow
                key={task.id}
                task={task}
                staff={allStaff} // Pass allStaff down if needed for display inside row (though archive usually doesn't need assignment changes)
                onViewDetails={handleViewDetails} // Pass the handler
                onDeleteTask={handleDelete} // Pass the handler
                isDeleting={isDeletingTask} // Pass the loading state for delete button
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  const getDisplayDateRange = () => {
     // ... (keep existing getDisplayDateRange) ...
     if (startDate && endDate) {
       return `${formatDate(startDate)} - ${formatDate(endDate)}`;
     } else if (startDate) {
       return `From ${formatDate(startDate)}`;
     } else if (endDate) {
       return `Until ${formatDate(endDate)}`;
     }
     return "All Time";
  };


  return (
    <div className="space-y-6">
      {/* Header with Date Range Filters */}
      <Card>
         {/* ... (keep existing card header/content for filters) ... */}
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Calendar className="h-5 w-5" />
             Archived Tasks - {getDisplayDateRange()}
           </CardTitle>
         </CardHeader>
         <CardContent>
           <div className="flex gap-4 items-end">
             <div className="flex-1">
               <Label htmlFor="start-date">Start Date</Label>
               <Input
                 id="start-date"
                 type="date"
                 value={startDate}
                 onChange={(e) => setStartDate(e.target.value)}
                 className="max-w-[200px]"
               />
             </div>
             <div className="flex-1">
               <Label htmlFor="end-date">End Date</Label>
               <Input
                 id="end-date"
                 type="date"
                 value={endDate}
                 onChange={(e) => setEndDate(e.target.value)}
                 className="max-w-[200px]"
               />
             </div>
           </div>
         </CardContent>
      </Card>

      {/* Tabs for Hotel Rooms and Other Locations */}
      <Tabs defaultValue="hotel" className="w-full">
         {/* ... (keep existing tabs list) ... */}
         <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
           <TabsTrigger value="hotel">
             Hotel Rooms ({regularTasks.length})
           </TabsTrigger>
           <TabsTrigger value="other">
             Other Locations ({otherTasks.length})
           </TabsTrigger>
         </TabsList>

        {/* Hotel Rooms Tab */}
        <TabsContent value="hotel" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTaskTable(
                regularTasks,
                startDate || endDate
                  ? `No completed hotel room tasks found for selected date range`
                  : "No completed hotel room tasks found"
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Locations Tab */}
        <TabsContent value="other" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTaskTable(
                otherTasks,
                startDate || endDate
                  ? `No completed other location tasks found for selected date range`
                  : "No completed other location tasks found"
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

       {/* Task Detail Dialog */}
       <TaskDetailDialog
         task={selectedTask}
         allStaff={allStaff}
         availableRooms={availableRooms} // Pass available rooms for editing the room field
         isOpen={isDetailDialogOpen}
         onOpenChange={setIsDetailDialogOpen}
         onUpdate={async (taskId, updates) => { // Handle update and refetch
            const success = await onUpdateTask(taskId, updates);
            if (success) fetchArchivedTasks(); // Refetch on successful update
            return success;
         }}
         isUpdating={isUpdatingTask}
       />
    </div>
  );
}
