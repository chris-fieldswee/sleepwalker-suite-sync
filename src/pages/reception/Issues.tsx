// src/pages/reception/Issues.tsx
import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReportNewIssueDialog } from "@/components/reception/ReportNewIssueDialog";
import { IssueDetailDialog } from "@/components/reception/NewIssueDetailDialog";
import { IssueTableRow } from "@/components/reception/IssueTableRow";
import type { Room, Staff } from "@/hooks/useReceptionData";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Issue = Database["public"]["Tables"]["issues"]["Row"];
type IssueStatus = Database["public"]["Enums"]["issue_status"];
type IssuePriority = Database["public"]["Enums"]["issue_priority"];

interface ExpandedIssue extends Issue {
  room: { id: string; name: string; color: string | null };
  assigned_to?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
  reported_by?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
  resolved_by?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
  task?: { id: string; date: string } | null;
}

interface IssuesProps {
  availableRooms: Room[];
  allStaff: Staff[];
}

export default function Issues({
  availableRooms,
  allStaff,
}: IssuesProps) {
  const { toast } = useToast();
  const [issues, setIssues] = useState<ExpandedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<IssuePriority | 'all'>('all');
  const [selectedIssue, setSelectedIssue] = useState<ExpandedIssue | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('issues')
        .select(`
          *,
          room:rooms!inner(id, name, color),
          assigned_to:users!assigned_to_user_id(id, name, first_name, last_name),
          reported_by:users!reported_by_user_id(id, name, first_name, last_name),
          resolved_by:users!resolved_by_user_id(id, name, first_name, last_name),
          task:tasks(id, date)
        `)
        .order('reported_at', { ascending: false });

      // Apply status filter
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      // Apply room filter
      if (filterRoom !== 'all') {
        query = query.eq('room_id', filterRoom);
      }

      // Apply priority filter
      if (filterPriority !== 'all') {
        query = query.eq('priority', filterPriority);
      }

      const { data, error } = await query;
      if (error) throw error;

      const formattedIssues = (data || []).map((issue: any) => ({
        ...issue,
        assigned_to: issue.assigned_to ? {
          ...issue.assigned_to,
          name: issue.assigned_to.first_name && issue.assigned_to.last_name
            ? `${issue.assigned_to.first_name} ${issue.assigned_to.last_name}`
            : issue.assigned_to.name
        } : null,
        reported_by: issue.reported_by ? {
          ...issue.reported_by,
          name: issue.reported_by.first_name && issue.reported_by.last_name
            ? `${issue.reported_by.first_name} ${issue.reported_by.last_name}`
            : issue.reported_by.name
        } : null,
        resolved_by: issue.resolved_by ? {
          ...issue.resolved_by,
          name: issue.resolved_by.first_name && issue.resolved_by.last_name
            ? `${issue.resolved_by.first_name} ${issue.resolved_by.last_name}`
            : issue.resolved_by.name
        } : null,
      }));

      setIssues(formattedIssues);
    } catch (error: any) {
      console.error("Error fetching issues:", error);
      toast({
        title: "Error",
        description: `Failed to load issues: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterRoom, filterPriority, toast]);

  useEffect(() => {
    fetchIssues();

    // Set up realtime subscription
    const channel = supabase
      .channel('issues-channel')
      .on<ExpandedIssue>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues' },
        () => fetchIssues()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchIssues]);

  const handleDelete = async (issueId: string) => {
    if (!confirm('Are you sure you want to delete this issue?')) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('issues')
        .delete()
        .eq('id', issueId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Issue deleted successfully",
      });
      
      fetchIssues();
    } catch (error: any) {
      console.error("Error deleting issue:", error);
      toast({
        title: "Error",
        description: `Failed to delete issue: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkResolved = async (issueId: string) => {
    try {
      const { error } = await supabase
        .from('issues')
        .update({ status: 'resolved' })
        .eq('id', issueId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Issue marked as resolved",
      });
      
      fetchIssues();
    } catch (error: any) {
      console.error("Error updating issue:", error);
      toast({
        title: "Error",
        description: `Failed to update issue: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleCreateIssue = async (roomId: string, description: string, photo: File | null): Promise<boolean> => {
    try {
      const { data: currentUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      let photoUrl: string | null = null;
      
      if (photo) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `issue_${Date.now()}.${fileExt}`;
        const filePath = `issue_photos/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task_issues')
          .upload(filePath, photo);

        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage.from('task_issues').getPublicUrl(filePath);
        photoUrl = urlData?.publicUrl || null;
      }

      const issueToInsert = {
        room_id: roomId,
        title: description.substring(0, 100),
        description: description,
        photo_url: photoUrl,
        reported_by_user_id: currentUser?.id || null,
        status: 'open' as const,
        priority: 'medium' as const,
      };

      const { error: insertError } = await supabase.from('issues').insert(issueToInsert);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Issue created successfully",
      });

      fetchIssues();
      return true;
    } catch (error: any) {
      console.error("Error creating issue:", error);
      toast({
        title: "Error",
        description: `Failed to create issue: ${error.message}`,
        variant: "destructive",
      });
      return false;
    }
  };

  const getStatusBadge = (status: IssueStatus) => {
    const config = {
      open: { label: 'Open', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
      in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
      resolved: { label: 'Resolved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
      closed: { label: 'Closed', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200' },
    };
    const { label, className } = config[status];
    return <Badge className={className}>{label}</Badge>;
  };

  const getPriorityBadge = (priority: IssuePriority) => {
    const config = {
      low: { label: 'Low', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
      medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
      high: { label: 'High', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' },
      urgent: { label: 'Urgent', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
    };
    const { label, className } = config[priority];
    return <Badge className={className}>{label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getDisplayName = (user: { id: string; name: string; first_name: string | null; last_name: string | null } | null) => {
    if (!user) return "Unassigned";
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.name;
  };

  // Use all issues (already filtered by the query)

  const handleClearFilters = () => {
    setFilterStatus('all');
    setFilterRoom('all');
    setFilterPriority('all');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIssues().finally(() => setRefreshing(false));
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Issues</h1>
          <p className="text-muted-foreground mt-1">Track and resolve reported maintenance issues</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <ReportNewIssueDialog
            availableRooms={availableRooms}
            onSubmit={handleCreateIssue}
            isSubmitting={false}
            triggerButton={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Issue
              </Button>
            }
          />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5 items-end">
            {/* Status Filter */}
            <div className="space-y-1">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as IssueStatus | 'all')}>
                <SelectTrigger id="status-filter" className="bg-card h-9 text-sm">
                  <SelectValue placeholder="Filter status..." />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="all" className="text-sm">All Statuses</SelectItem>
                  <SelectItem value="open" className="text-sm">Open</SelectItem>
                  <SelectItem value="in_progress" className="text-sm">In Progress</SelectItem>
                  <SelectItem value="resolved" className="text-sm">Resolved</SelectItem>
                  <SelectItem value="closed" className="text-sm">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Room Filter */}
            <div className="space-y-1">
              <Label htmlFor="room-filter">Room</Label>
              <Select value={filterRoom} onValueChange={setFilterRoom}>
                <SelectTrigger id="room-filter" className="bg-card h-9 text-sm">
                  <SelectValue placeholder="Filter room..." />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="all" className="text-sm">All Rooms</SelectItem>
                  {availableRooms.map(room => (
                    <SelectItem key={room.id} value={room.id} className="text-sm">
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority Filter */}
            <div className="space-y-1">
              <Label htmlFor="priority-filter">Priority</Label>
              <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as IssuePriority | 'all')}>
                <SelectTrigger id="priority-filter" className="bg-card h-9 text-sm">
                  <SelectValue placeholder="Filter priority..." />
                </SelectTrigger>
                <SelectContent className="bg-card z-50">
                  <SelectItem value="all" className="text-sm">All Priorities</SelectItem>
                  <SelectItem value="low" className="text-sm">Low</SelectItem>
                  <SelectItem value="medium" className="text-sm">Medium</SelectItem>
                  <SelectItem value="high" className="text-sm">High</SelectItem>
                  <SelectItem value="urgent" className="text-sm">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Button */}
            <div className="md:col-span-3 lg:col-span-2">
              <Button variant="outline" onClick={handleClearFilters} className="w-full h-9 text-sm">
                <X className="mr-1.5 h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle>Issues</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !refreshing ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="ml-2">Loading issues...</span>
            </div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium text-muted-foreground">No issues found</p>
              <p className="text-sm text-muted-foreground">Try adjusting the filters or report a new issue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[calc(8*3.5rem)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 sticky top-0 z-10">
                    <TableHead className="font-semibold w-[120px]">Room</TableHead>
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold text-center w-[100px]">Priority</TableHead>
                    <TableHead className="font-semibold text-center w-[120px]">Status</TableHead>
                    <TableHead className="font-semibold w-[150px]">Assigned To</TableHead>
                    <TableHead className="font-semibold text-center w-[120px]">Reported</TableHead>
                    <TableHead className="font-semibold text-center w-[80px]">Photo</TableHead>
                    <TableHead className="font-semibold text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <IssueTableRow
                      key={issue.id}
                      issue={issue}
                      onViewDetails={(issue) => {
                        setSelectedIssue(issue);
                        setIsDetailDialogOpen(true);
                      }}
                      onDelete={handleDelete}
                      isDeleting={isDeleting}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Issue Detail Dialog */}
      <IssueDetailDialog
        issue={selectedIssue}
        allStaff={allStaff}
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onUpdate={fetchIssues}
      />
    </div>
  );
}
