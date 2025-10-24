import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type IssueTask = {
  id: string;
  date: string;
  room: { name: string; color: string | null };
  user: { name: string } | null;
  issue_description: string | null;
  issue_photo: string | null;
  status: string;
  cleaning_type: string;
};

export default function Issues() {
  const { toast } = useToast();
  const [issues, setIssues] = useState<IssueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");

  useEffect(() => {
    fetchIssues();

    const channel = supabase
      .channel("issues-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: "issue_flag=eq.true" },
        () => {
          fetchIssues();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, issue_description, issue_photo,
          room:rooms!inner(name, color),
          user:users(name)
        `)
        .eq("issue_flag", true)
        .order("date", { ascending: false });

      if (filter === "active") {
        query = query.neq("status", "done");
      } else if (filter === "resolved") {
        query = query.eq("status", "done");
      }

      const { data, error } = await query;
      if (error) throw error;
      setIssues(data as IssueTask[]);
    } catch (error: any) {
      console.error("Error fetching issues:", error);
      toast({ title: "Error", description: "Failed to load issues", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      todo: { label: "To Do", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" },
      in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" },
      done: { label: "Resolved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
      repair_needed: { label: "Repair Needed", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200" },
    };
    const config = statusConfig[status] || { label: status, className: "" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Issues</h1>
        <p className="text-muted-foreground mt-1">Track and resolve reported maintenance issues</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={filter === "active" ? "default" : "outline"}
          onClick={() => setFilter("active")}
        >
          Active Issues
        </Button>
        <Button
          variant={filter === "resolved" ? "default" : "outline"}
          onClick={() => setFilter("resolved")}
        >
          Resolved
        </Button>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All Issues
        </Button>
      </div>

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
              {filter === "active" ? "All issues have been resolved" : "Try adjusting the filter"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {issues.map((issue) => (
            <Card key={issue.id} className="border-l-4 border-l-red-500">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    <CardTitle className="text-lg">
                      {issue.room.name} - {issue.cleaning_type}
                    </CardTitle>
                  </div>
                  {getStatusBadge(issue.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                  <span>Date: {formatDate(issue.date)}</span>
                  <span>•</span>
                  <span>Reported by: {issue.user?.name || "Unassigned"}</span>
                </div>
              </CardHeader>
              <CardContent>
                {issue.issue_description && (
                  <div className="mb-4">
                    <h4 className="font-semibold mb-1">Description:</h4>
                    <p className="text-sm text-muted-foreground">{issue.issue_description}</p>
                  </div>
                )}
                {issue.issue_photo && (
                  <div>
                    <h4 className="font-semibold mb-2">Photo Evidence:</h4>
                    <a
                      href={issue.issue_photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block group"
                    >
                      <div className="relative overflow-hidden rounded-lg border hover:border-primary transition-colors">
                        <img
                          src={issue.issue_photo}
                          alt="Issue photo"
                          className="h-48 w-auto object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
