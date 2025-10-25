// src/components/reception/IssueDetailDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckSquare } from "lucide-react"; // Added CheckSquare
import type { Database } from "@/integrations/supabase/types";
import type { Staff } from '@/hooks/useReceptionData';

export type IssueTask = {
  id: string;
  date: string;
  room: { name: string; color: string | null };
  user: { id: string; name: string } | null;
  issue_description: string | null;
  issue_photo: string | null;
  // status: Database["public"]["Enums"]["task_status"]; // Status might still be useful internally
  issue_flag: boolean | null; // Use issue_flag for status display/update
  cleaning_type: string;
  reception_notes: string | null;
  housekeeping_notes: string | null;
};

// Simplified status type based on issue_flag
type IssueDisplayStatus = 'To Fix' | 'Fixed';

interface IssueDetailDialogProps {
  issue: IssueTask | null;
  allStaff: Staff[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Updated onUpdate prop type
  onUpdate: (taskId: string, updates: Partial<{
      issue_flag: boolean | null;
      reception_notes: string | null;
      user_id: string | null;
  }>) => Promise<boolean>;
}

export function IssueDetailDialog({
    issue,
    allStaff,
    isOpen,
    onOpenChange,
    onUpdate
}: IssueDetailDialogProps) {
    // State now focuses on assigneee and notes, status is derived from issue_flag
    const [assignedStaffId, setAssignedStaffId] = useState<string>("unassigned");
    const [receptionNotes, setReceptionNotes] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    // Update state when the selected issue changes
    useEffect(() => {
        if (issue) {
            setAssignedStaffId(issue.user?.id || "unassigned");
            setReceptionNotes(issue.reception_notes || "");
        } else {
            // Reset when dialog closes or issue becomes null
            setAssignedStaffId("unassigned");
            setReceptionNotes("");
        }
    }, [issue]);

    const handleSave = async () => {
        if (!issue) return;
        setIsSaving(true);
        // Prepare updates for assignee and notes only initially
        const updates: Partial<{ issue_flag: boolean | null; reception_notes: string | null; user_id: string | null }> = {
            user_id: assignedStaffId === "unassigned" ? null : assignedStaffId,
            reception_notes: receptionNotes || null,
        };

        // If the issue is currently active (flag is true), and we are saving,
        // it means we haven't clicked the "Mark Fixed" button yet.
        // If we implement a "Mark Fixed" button separately, we'd add issue_flag: false there.
        // For now, let's keep it simple: Save button only saves Assignee/Notes.

        const success = await onUpdate(issue.id, updates);
        setIsSaving(false);
        if (success) {
            onOpenChange(false); // Close dialog on success
        }
    };

    // New handler for the "Mark Fixed" button
    const handleMarkFixed = async () => {
         if (!issue) return;
         setIsSaving(true); // Reuse saving state
         const updates = {
             issue_flag: false, // Mark as fixed
             // Optionally add current notes/assignee if needed, or update separately
             // user_id: assignedStaffId === "unassigned" ? null : assignedStaffId,
             // reception_notes: receptionNotes || null,
         };
         const success = await onUpdate(issue.id, updates);
         setIsSaving(false);
         if (success) {
             onOpenChange(false); // Close dialog
         }
    };

    const formatDate = (dateString: string | null) => {
      // ... (formatDate remains the same) ...
      if (!dateString) return "N/A";
      return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
      });
    };

    // Get simplified status badge based on issue_flag
    const getIssueStatusBadge = (isIssue: boolean | null): React.ReactNode => {
      if (isIssue === true) {
          return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">To Fix</Badge>;
      }
      // Assuming null or false means fixed
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">Fixed</Badge>;
    };

    if (!issue) return null;

    const currentIssueStatus: IssueDisplayStatus = issue.issue_flag === true ? 'To Fix' : 'Fixed';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle>Issue Details - Room {issue.room.name}</DialogTitle>
                            <DialogDescription>
                                Reported on {formatDate(issue.date)}. Task Type: {issue.cleaning_type}.
                            </DialogDescription>
                        </div>
                        {getIssueStatusBadge(issue.issue_flag)}
                    </div>
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
                       // ... photo display remains the same ...
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
                     <div className="grid grid-cols-1 gap-4 items-end">
                         {/* Removed Status Dropdown */}
                         <div className="space-y-1">
                            <Label htmlFor="issue-assignee">Assign Staff</Label>
                             <Select value={assignedStaffId} onValueChange={setAssignedStaffId} disabled={isSaving || currentIssueStatus === 'Fixed'}>
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
                            disabled={isSaving || currentIssueStatus === 'Fixed'}
                            maxLength={2000}
                        />
                         <p className="text-xs text-muted-foreground text-right">{receptionNotes.length} / 2000</p>
                    </div>
                </div>
                <DialogFooter className="justify-between sm:justify-between">
                    {/* Mark Fixed button shown only if issue is active */}
                    {currentIssueStatus === 'To Fix' ? (
                        <Button
                            type="button"
                            variant="default"
                            onClick={handleMarkFixed}
                            disabled={isSaving}
                            className="bg-green-600 hover:bg-green-700 text-white"
                        >
                            <CheckSquare className="mr-2 h-4 w-4" /> Mark as Fixed
                        </Button>
                    ) : (
                        <span className="text-sm text-green-700 font-medium">Issue marked as fixed.</span>
                    )}

                    <div className="flex gap-2">
                        <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                        {/* Save button might be less necessary if "Mark Fixed" is the primary action, but kept for notes/assignee */}
                         <Button
                            type="button"
                            onClick={handleSave} // Saves Assignee/Notes
                            disabled={isSaving || currentIssueStatus === 'Fixed'} // Disable save if fixed
                         >
                            {isSaving ? "Saving..." : "Save Notes/Assignee"}
                         </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
