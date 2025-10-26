import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Cleaning type labels with full descriptive names
const cleaningTypeLabels: Record<string, string> = {
  W: "Wyjazd",
  P: "Przyjazd",
  T: "Trakt",
  O: "Odświeżenie",
  G: "Generalne",
  S: "Standard"
};

type Task = {
  id: string;
  date: string;
  status: string;
  room: { name: string; color: string | null; group_type: string };
  user: { name: string } | null;
  cleaning_type: string;
  guest_count: number;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  reception_notes: string | null;
  housekeeping_notes: string | null;
  stop_time: string | null;
};

export default function Archive() {
  const { toast } = useToast();
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchArchivedTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchArchivedTasks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, guest_count, time_limit, actual_time,
          difference, reception_notes, housekeeping_notes, stop_time,
          room:rooms!inner(name, color, group_type),
          user:users(name)
        `)
        .eq("status", "done") // Only fetch completed tasks
        .order("date", { ascending: false })
        .order("stop_time", { ascending: false })
        .limit(500); // Add a limit for performance

      if (startDate) query = query.gte("date", startDate);
      if (endDate) query = query.lte("date", endDate);

      const { data, error } = await query;
      if (error) throw error;
      setArchivedTasks(data as Task[]);
    } catch (error: any) {
      console.error("Error fetching archived tasks:", error);
      toast({ title: "Error", description: "Failed to load archived tasks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    // Basic date formatting, adjust as needed
    try {
        return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
            year: '2-digit', month: 'short', day: 'numeric', timeZone: 'UTC'
        });
    } catch (e) {
        return dateString; // Fallback
    }
  };

  // Split tasks into two groups
  const regularTasks = archivedTasks.filter(task => task.room.group_type !== 'OTHER');
  const otherTasks = archivedTasks.filter(task => task.room.group_type === 'OTHER');

  // *** MODIFICATION START: Guest icon renderer (same as TaskTableRow) ***
  const renderGuestIcons = (count: number) => {
    const icons = [];
    const validCount = Math.max(1, Math.floor(count) || 1);
    const displayCount = Math.min(validCount, 10);

    for (let i = 0; i < displayCount; i++) {
      icons.push(<User key={i} className="h-4 w-4 text-muted-foreground" />);
    }
    if (validCount > displayCount) {
       icons.push(<span key="plus" className="text-xs text-muted-foreground ml-1">+{validCount - displayCount}</span>);
    }
    return <div className="flex items-center justify-center gap-0.5">{icons}</div>;
  };
  // *** MODIFICATION END ***

  const renderTaskTable = (taskList: Task[], emptyMessage: string) => (
    loading ? (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-2">Loading archived tasks...</span>
      </div>
    ) : taskList.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground">Adjust the date range to see more results</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[90px]">Date</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead className="text-center w-[60px]">Type</TableHead>
              <TableHead className="text-center w-[80px]">Guests</TableHead>
              <TableHead className="text-center w-[60px]">Limit</TableHead>
              <TableHead className="text-center w-[60px]">Actual</TableHead>
              <TableHead className="text-center w-[60px]">Diff</TableHead>
              <TableHead className="min-w-[150px]">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map((task) => (
              <TableRow key={task.id} className="text-xs">
                <TableCell className="whitespace-nowrap">{formatDate(task.date)}</TableCell>
                <TableCell>
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: task.room.color || '#E5E7EB' }} // Default color
                  />
                  {task.room.name}
                </TableCell>
                <TableCell>{task.user?.name || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5">{cleaningTypeLabels[task.cleaning_type] || task.cleaning_type}</Badge>
                </TableCell>
                 {/* *** MODIFICATION START: Use guest icon renderer *** */}
                <TableCell className="text-center">
                  {renderGuestIcons(task.guest_count)}
                </TableCell>
                 {/* *** MODIFICATION END *** */}
                <TableCell className="text-center">{task.time_limit ?? "-"}</TableCell>
                <TableCell className="text-center">{task.actual_time ?? "-"}</TableCell>
                <TableCell className="text-center">
                  {task.difference !== null ? (
                    <span className={cn(
                        "font-medium",
                        task.difference > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                    )}>
                      {task.difference > 0 ? "+" : ""}{task.difference}
                    </span>
                  ) : "-"}
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={task.housekeeping_notes || task.reception_notes || undefined}>
                  {task.housekeeping_notes ? `HK: ${task.housekeeping_notes}` : task.reception_notes ? `REC: ${task.reception_notes}` : <span className="text-muted-foreground italic">No notes</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  // --- Date filter rendering function ---
  const renderDateFilters = (idPrefix: string) => (
      <Card>
          <CardHeader className="pb-3 pt-4">
              <CardTitle className="text-base">Filter by Date Range</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <Label htmlFor={`${idPrefix}-start-date`} className="text-xs">Start Date</Label>
                      <div className="relative">
                          <Input
                              id={`${idPrefix}-start-date`}
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="h-9 text-sm"
                          />
                          <Calendar className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                  </div>
                  <div>
                      <Label htmlFor={`${idPrefix}-end-date`} className="text-xs">End Date</Label>
                      <div className="relative">
                          <Input
                              id={`${idPrefix}-end-date`}
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="h-9 text-sm"
                              min={startDate || undefined} // Ensure end date is not before start date
                          />
                          <Calendar className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                  </div>
              </div>
          </CardContent>
      </Card>
  );


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Archive</h1>
        <p className="text-muted-foreground mt-1">Review completed tasks and performance history</p>
      </div>

      <Tabs defaultValue="regular" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regular">Hotel Rooms ({!loading ? regularTasks.length : '...'})</TabsTrigger>
          <TabsTrigger value="other">Other Locations ({!loading ? otherTasks.length : '...'})</TabsTrigger>
        </TabsList>

        {/* Regular Rooms Tab */}
        <TabsContent value="regular" className="space-y-4">
          {renderDateFilters("regular")}
          <Card>
            <CardHeader>
              <CardTitle>Completed Hotel Room Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(regularTasks, "No completed hotel room tasks found for this date range")}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Locations Tab */}
        <TabsContent value="other" className="space-y-4">
           {renderDateFilters("other")}
          <Card>
            <CardHeader>
              <CardTitle>Completed Other Location Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(otherTasks, "No completed other location tasks found for this date range")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
