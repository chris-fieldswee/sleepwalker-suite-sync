// src/pages/reception/Issues.tsx
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink, Plus, User, CalendarDays, Wrench, Check } from "lucide-react"; // Added Wrench, Check
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReportNewIssueDialog } from "@/components/reception/ReportNewIssueDialog";
import { IssueDetailDialog, IssueTask } from "@/components/reception/IssueDetailDialog";
import type { Room, Staff } from "@/hooks/useReceptionData";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

// Remove TaskStatus if no longer needed here
// type TaskStatus = Database["public"]["Enums"]["task_status"];

// Simplified filter type
type IssueFilterStatus = "all" | "active" | "fixed"; // Changed 'resolved' to 'fixed'

interface IssuesProps {
  availableRooms: Room[];
  allStaff: Staff[];
  handleReportNewIssue: (roomId: string, description: string, photo: File | null) => Promise<boolean>;
  isSubmittingNewIssue: boolean;
  handleUpdateIssue: (taskId: string, updates: Partial<{ issue_flag: boolean | null; reception_notes: string | null; user_id: string | null }>) => Promise<boolean>; // Updated type
  isUpdatingIssue: boolean;
}

export default function Issues({
    availableRooms,
    allStaff,
    handleReportNewIssue,
    isSubmittingNewIssue,
    handleUpdateIssue
}: IssuesProps) {
  const { toast } = useToast();
  const [issues, setIssues] = useState<IssueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<IssueFilterStatus>("active"); // Use new filter type
  const [selectedIssue, setSelectedIssue] = useState<IssueTask | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  useEffect(() => {
    fetchIssues();
    const channel = supabase
      .channel("issues-channel-reception")
      .on<IssueTask>(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `issue_flag=eq.true` }, // Keep listening for issue_flag=true initially? Or adjust based on needs.
        // Consider listening to issue_flag=is.null or issue_flag=eq.false too if needed for 'Fixed' updates
        (payload) => {
            console.log("Issues change received:", payload);
            fetchIssues(); // Refetch on any relevant change
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
  }, [filter]);

   const fetchIssues = async () => {
     setLoading(true);
     try {
       // Fetch relevant fields, including issue_flag
       let query = supabase
         .from("tasks")
         .select(`
           id, date, status, cleaning_type, issue_description, issue_photo,
           reception_notes, housekeeping_notes, issue_flag, /* Ensure issue_flag is selected */
           room:rooms!inner(name, color),
           user:users(id, name)
         `)
         // Base query might fetch all potential issues initially, filter client-side or DB-side
         // .eq("issue_flag", true) // Initial thought, but might need modification for 'Fixed' filter
         .order("date", { ascending: false })
         .order("created_at", { ascending: false });

       // Apply filter based on issue_flag
       if (filter === "active") {
         query = query.eq("issue_flag", true);
       } else if (filter === "fixed") {
          // Query for false OR null
         query = query.or('issue_flag.is.null,issue_flag.eq.false');
       }
       // 'all' filter doesn't add issue_flag constraints here, shows both

       const { data, error } = await query;
       if (error) throw error;
       setIssues((data as IssueTask[]) || []);
     } catch (error: any) {
       console.error("Error fetching issues:", error);
       toast({ title: "Error", description: `Failed to load issues: ${error.message}`, variant: "destructive" });
     } finally {
       setLoading(false);
     }
   };

    // --- Helper functions ---
    const formatDate = (dateString: string | null) => {
        // ... (formatDate remains the same) ...
        if (!dateString) return "N/A";
        return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
        });
    };

    // Simplified status badge based on issue_flag
    const getIssueStatusBadge = (isIssue: boolean | null): React.ReactNode => {
      if (isIssue === true) {
          return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">To Fix</Badge>;
      }
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">Fixed</Badge>;
    };

    // --- Event Handlers ---
    const handleRowClick = (issue: IssueTask) => {
        setSelectedIssue(issue);
        setIsDetailDialogOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        setIsDetailDialogOpen(open);
        if (!open) {
            setSelectedIssue(null);
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
           <Wrench className="mr-2 h-4 w-4" /> {/* Icon for active */}
          Active Issues
        </Button>
        <Button
          variant={filter === "fixed" ? "default" : "outline"}
          onClick={() => setFilter("fixed")}
          size="sm"
        >
           <Check className="mr-2 h-4 w-4" /> {/* Icon for fixed */}
           Fixed
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
              {filter === "active" ? "No active issues require attention." : "Try adjusting the filter or report a new issue."}
            </p>
          </CardContent>
        </Card>
      ) : (
        // Restored single column grid (list view)
        <div className="grid grid-cols-1 gap-4">
          {issues.map((issue) => (
            <Card
              key={issue.id}
              className={cn(
                  "border-l-4 hover:shadow-md transition-shadow cursor-pointer flex flex-col sm:flex-row", // Use flex for layout
                   // Use issue_flag for border color
                  issue.issue_flag === true ? "border-l-red-500" : "border-l-green-500"
              )}
              onClick={() => handleRowClick(issue)}
            >
              {/* Image Column */}
              {issue.issue_photo && (
                <div className="flex-shrink-0 w-full sm:w-48 md:w-64 h-40 sm:h-auto overflow-hidden">
                   <img
                     src={issue.issue_photo}
                     alt="Issue"
                     className="w-full h-full object-cover"
                   />
                </div>
              )}
              {/* Content Column */}
              <div className={cn("flex-grow", !issue.issue_photo && "w-full")}> {/* Ensure content takes full width if no photo */}
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-start justify-between">
                       <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          {issue.room.name}
                      </CardTitle>
                      {/* Use simplified status badge */}
                      {getIssueStatusBadge(issue.issue_flag)}
                    </div>
                     <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                       <p className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> Reported: {formatDate(issue.date)}
                       </p>
                        <p className="flex items-center gap-1">
                           <User className="h-3 w-3" /> Assigned: {issue.user?.name || "Unassigned"}
                        </p>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 pt-1">
                      <p className="text-sm text-muted-foreground line-clamp-3">
                         {issue.issue_description || <span className="italic">No description provided.</span>}
                      </p>
                  </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}

       {/* Detail Dialog - Pass the updated handler */}
       <IssueDetailDialog
         issue={selectedIssue}
         allStaff={allStaff}
         isOpen={isDetailDialogOpen}
         onOpenChange={handleDialogClose}
         onUpdate={handleUpdateIssue} // Pass the correct update handler
       />
    </div>
  );
}
