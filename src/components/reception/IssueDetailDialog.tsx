// src/components/reception/IssueDetailDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Staff } from '@/hooks/useReceptionData';

// Define the shape of the issue data more precisely
export type IssueTask = {
  id: string;
  date: string;
  room: { name: string; color: string | null };
  user: { id: string; name: string } | null; // Allow user to be null initially
  issue_description: string | null;
  issue_photo: string | null;
  status: Database["public"]["Enums"]["task_status"];
  cleaning_type: string;
  reception_notes: string | null;
  housekeeping_notes: string | null; // Add housekeeping notes
};

type TaskStatus = Database["public"]["Enums"]["task_status"];
// Define possible statuses reception can set
const availableStatuses: TaskStatus[] = ['todo', 'in_progress', 'paused', 'done', 'repair_needed'];

interface IssueDetailDialogProps {
  issue: IssueTask | null; // Allow null when dialog is closed
  allStaff: Staff[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (taskId: string, updates: Partial<Pick<IssueTask, 'status' | 'reception_notes'> & { user_id: string | null }>) => Promise<boolean>; // Specify update fields
}

export function IssueDetailDialog({
    issue,
    allStaff,
    isOpen,
    onOpenChange,
    onUpdate
}: IssueDetailDialogProps) {
    const [currentStatus, setCurrentStatus] = useState<TaskStatus | string>(""); // Use string to handle potential initial null/undefined
    const [assignedStaffId, setAssignedStaffId] = useState<string>("unassigned");
    const [receptionNotes, setReceptionNotes] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // Update state when the selected issue changes
    useEffect(() => {
        if (issue) {
            setCurrentStatus(issue.status || 'repair_needed'); // Default to repair_needed if somehow null
            setAssignedStaffId(issue.user?.id || "unassigned");
            setReceptionNotes(issue.reception_notes || "");
        } else {
            // Reset when dialog closes or issue becomes null
            setCurrentStatus("");
            setAssignedStaffId("unassigned");
            setReceptionNotes("");
        }
    }, [issue]);

    const handleSave = async () => {
        if (!issue) return;
        setIsSaving(true);
        const updates: Partial<Pick<IssueTask, 'status' | 'reception_notes'> & { user_id: string | null }> = {
            status: currentStatus as TaskStatus, // Cast to TaskStatus
            user_id: assignedStaffId === "unassigned" ? null : assignedStaffId,
            reception_notes: receptionNotes || null,
        };

        // If setting status back to 'todo' or 'in_progress' etc., clear the issue flag?
        // This depends on desired workflow. For now, we only update status.
        // You might want to add: if (currentStatus !== 'repair_needed') updates.issue_flag = false;

        const success = await onUpdate(issue.id, updates);
        setIsSaving(false);
        if (success) {
            onOpenChange(false); // Close dialog on success
        }
    };

    const formatDate = (dateString: string | null) => {
      if (!dateString) return "N/A";
      return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
      });
    };

    // Helper to get status label and color (copied/adapted from Issues.tsx)
    const getStatusBadge = (status: string) => {
      const statusConfig: Record<string, { label: string; className: string }> = {
        todo: { label: "To Do", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" },
        in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" },
        paused: { label: "Paused", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200" }, // Added paused
        done: { label: "Resolved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
        repair_needed: { label: "Repair Needed", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200" },
      };
      const config = statusConfig[status] || { label: status, className: "" };
      return <Badge className={config.className}>{config.label}</Badge>;
    };

    if (!issue) return null; // Don't render anything if no issue is selected

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Issue Details - Room {issue.room.name}</DialogTitle>
                    <DialogDescription>
                        Reported on {formatDate(issue.date)}. Task Type: {issue.cleaning_type}.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                    {/* Display Fields */}
                    <div className="space-y-1">
                        <Label className="text-muted-foreground">Description</Label>
                        <p className="text-sm border p-2 rounded bg-muted/30 min-h-[40px]">
                            {issue.issue_description || <span className="italic text-muted-foreground/70">No description provided.</span>}
                        </p>
                    </div>

                    {issue.housekeeping_notes && (
                         <div className="space-y-1">
                            <Label className="text-muted-foreground">Housekeeper Notes</Label>
                             <p className="text-sm border p-2 rounded bg-muted/30 min-h-[40px]">
                                {issue.housekeeping_notes}
                             </p>
                         </div>
                    )}

                    {issue.issue_photo && (
                        <div className="space-y-1">
                            <Label className="text-muted-foreground">Photo</Label>
                             <a href={issue.issue_photo} target="_blank" rel="noopener noreferrer" className="block w-fit">
                                <img
                                    src={issue.issue_photo}
                                    alt="Issue evidence"
                                    className="max-h-40 w-auto object-contain rounded border hover:opacity-80 transition-opacity"
                                />
                                <span className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                                    View full size <ExternalLink className="h-3 w-3" />
                                </span>
                             </a>
                        </div>
                    )}

                    <hr className="my-2" />

                    {/* Editable Fields */}
                     <div className="grid grid-cols-2 gap-4 items-end">
                        <div className="space-y-1">
                            <Label htmlFor="issue-status">Status</Label>
                             <Select value={currentStatus} onValueChange={(value) => setCurrentStatus(value as TaskStatus)} disabled={isSaving}>
                                <SelectTrigger id="issue-status">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableStatuses.map(status => (
                                        <SelectItem key={status} value={status}>
                                            {getStatusBadge(status)} {/* Show badge in dropdown */}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="issue-assignee">Assign Staff</Label>
                             <Select value={assignedStaffId} onValueChange={setAssignedStaffId} disabled={isSaving}>
                                <SelectTrigger id="issue-assignee">
                                    <SelectValue placeholder="Assign staff" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {allStaff.map(staff => (
                                        <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1 mt-2">
                        <Label htmlFor="issue-reception-notes">Reception Notes</Label>
                        <Textarea
                            id="issue-reception-notes"
                            value={receptionNotes}
                            onChange={(e) => setReceptionNotes(e.target.value)}
                            className="min-h-[80px]"
                            placeholder="Add notes for maintenance or housekeeping..."
                            disabled={isSaving}
                            maxLength={2000} // Add max length
                        />
                         <p className="text-xs text-muted-foreground text-right">{receptionNotes.length} / 2000</p>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                    <Button type="button" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
