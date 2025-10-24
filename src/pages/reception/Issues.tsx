// src/pages/reception/Issues.tsx
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, User, CalendarDays } from "lucide-react"; // Added User, CalendarDays
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReportNewIssueDialog } from "@/components/reception/ReportNewIssueDialog";
// *** Import the detail dialog and types ***
import { IssueDetailDialog, IssueTask } from "@/components/reception/IssueDetailDialog";
import type { Room, Staff } from "@/hooks/useReceptionData"; // Import Staff
import { cn } from "@/lib/utils"; // Import cn for conditional classes

// Define TaskStatus locally if not imported
type TaskStatus = Database["public"]["Enums"]["task_status"];

interface IssuesProps {
  availableRooms: Room[];
  allStaff: Staff[]; // Receive staff list
  handleReportNewIssue: (roomId: string, description: string, photo: File | null) => Promise<boolean>;
  isSubmittingNewIssue: boolean;
  // *** Add props for updating issues ***
  handleUpdateIssue: (taskId: string, updates: Partial<Pick<IssueTask, 'status' | 'reception_notes'> & { user_id: string | null }>) => Promise<boolean>;
  isUpdatingIssue: boolean; // Receive loading state (optional, handled in dialog)
}

export default function Issues({
    availableRooms,
    allStaff,
    handleReportNewIssue,
    isSubmittingNewIssue,
    handleUpdateIssue // Destructure new props
    // isUpdatingIssue // Not directly needed here, but passed down
}: IssuesProps) {
  const { toast } = useToast();
  const [issues, setIssues] = useState<IssueTask[]>([]); // Use the more specific IssueTask type
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");

  // *** State for detail dialog ***
  const [selectedIssue, setSelectedIssue] = useState<IssueTask | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Fetching and subscription logic remains the same
  useEffect(() => {
    fetchIssues();
    const channel = supabase
      .channel("issues-channel-reception") // Use a unique channel name
      .on<IssueTask>( // Use specific type
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: "issue_flag=eq.true" },
        (payload) => {
            console.log("Issues change received:", payload);
             // Simple refetch on any change for now
            fetchIssues();
        }
      )
      .subscribe((status, err) => {
           if (err) console.error("Realtime subscription error:", err);
           else console.log("Realtime subscription status:", status);
      });

    return () => {
       console.log("Removing issues-channel-reception");
      supabase.removeChannel(channel).catch(err => console.error("Error removing issues channel:", err));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]); // Rerun fetch when filter changes

   const fetchIssues = async () => {
     setLoading(true);
     try {
       let query = supabase
         .from("tasks")
         .select(`
           id, date, status, cleaning_type, issue_description, issue_photo,
           reception_notes, housekeeping_notes, /* Select notes */
           room:rooms!inner(name, color),
           user:users(id, name) /* Select user id and name */
         `)
         .eq("issue_flag", true)
         .order("date", { ascending: false })
         .order("created_at", { ascending: false }); // Sort by creation time as secondary

       if (filter === "active") {
         query = query.neq("status", "done");
       } else if (filter === "resolved") {
         query = query.eq("status", "done");
       }

       const { data, error } = await query;
       if (error) throw error;
       // Ensure status is correctly typed
       setIssues((data as IssueTask[]) || []);
     } catch (error: any) {
       console.error("Error fetching issues:", error);
       toast({ title: "Error", description: "Failed to load issues", variant: "destructive" });
     } finally {
       setLoading(false);
     }
   };

    // --- Helper functions ---
   const formatDate = (dateString: string | null) => {
        if (!dateString) return "N/A";
        return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
        });
    };

    const getStatusBadge = (status: TaskStatus | string | null) => { // Accept TaskStatus | null
      if (!status) return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
      const statusConfig: Record<string, { label: string; className: string }> = {
        todo: { label: "To Do", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" },
        in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" },
        paused: { label: "Paused", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200" },
        done: { label: "Resolved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
        repair_needed: { label: "Repair Needed", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200" },
      };
      const config = statusConfig[status] || { label: status, className: "" };
      return <Badge className={config.className}>{config.label}</Badge>;
    };

    // --- Event Handlers ---
    const handleRowClick = (issue: IssueTask) => {
        setSelectedIssue(issue);
        setIsDetailDialogOpen(true);
    };

    // Close dialog handler
    const handleDialogClose = (open: boolean) => {
        setIsDetailDialogOpen(open);
        if (!open) {
            setSelectedIssue(null); // Clear selected issue when closing
        }
    };


  return (
    <div className="space-y-4">
      {/* Header Area */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Issues</h1>
          <p className="text-muted-foreground mt-1">Track and resolve reported maintenance issues</p>
        </div>
        <ReportNewIssueDialog
          availableRooms={availableRooms}
          onSubmit={handleReportNewIssue}
          isSubmitting={isSubmittingNewIssue}
          triggerButton={
              <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" /> Report New Issue
              </Button>
          }
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={filter === "active" ? "default" : "outline"}
          onClick={() => setFilter("active")}
          size="sm"
        >
          Active Issues
        </Button>
        <Button
          variant={filter === "resolved" ? "default" : "outline"}
          onClick={() => setFilter("resolved")}
          size="sm"
        >
          Resolved
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          size="sm"
        >
          All Issues
        </Button>
      </div>

       {/* Loading / Empty / List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <span className="ml-2">Loading issues...</span>
        </div>
      ) : issues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No issues found</p>
            <p className="text-sm text-muted-foreground">
              {filter === "active" ? "All active issues have been resolved." : "Try adjusting the filter or report a new issue."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {issues.map((issue) => (
            // *** Make Card clickable ***
            <Card
              key={issue.id}
              className={cn(
                  "border-l-4 hover:shadow-md transition-shadow cursor-pointer",
                  issue.status === 'done' ? "border-l-green-500" : "border-l-red-500"
              )}
              onClick={() => handleRowClick(issue)}
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-start justify-between">
                   <CardTitle className="text-base font-semibold flex items-center gap-1.5">
                      <AlertTriangle className={cn("h-4 w-4", issue.status === 'done' ? "text-green-500" : "text-red-500")} />
                      {issue.room.name}
                  </CardTitle>
                  {getStatusBadge(issue.status)}
                </div>
                 {/* Consistent Info Rows */}
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                   <p className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Date: {formatDate(issue.date)}
                   </p>
                    <p className="flex items-center gap-1">
                       <User className="h-3 w-3" /> Assigned: {issue.user?.name || "Unassigned"}
                    </p>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                     {issue.issue_description || <span className="italic">No description.</span>}
                  </p>
                  {/* Optionally show a small photo preview */}
                  {issue.issue_photo && (
                       <img
                         src={issue.issue_photo}
                         alt="Issue thumbnail"
                         className="mt-2 h-10 w-10 object-cover rounded border"
                       />
                   )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

       {/* Detail Dialog */}
       <IssueDetailDialog
         issue={selectedIssue}
         allStaff={allStaff}
         isOpen={isDetailDialogOpen}
         onOpenChange={handleDialogClose}
         onUpdate={handleUpdateIssue}
       />
    </div>
  );
}
