// src/components/reception/IssueDetailDialog.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, CheckSquare, Edit, Save } from "lucide-react"; // Added Edit, Save
import type { Database } from "@/integrations/supabase/types";
import type { Staff } from '@/hooks/useReceptionData';

export type IssueTask = {
  id: string;
  date: string;
  room: { name: string; color: string | null };
  user: { id: string; name: string } | null;
  issue_description: string | null;
  issue_photo: string | null;
  issue_flag: boolean | null;
  cleaning_type: string;
  reception_notes: string | null;
  housekeeping_notes: string | null;
};

type IssueDisplayStatus = 'To Fix' | 'Fixed';

interface IssueDetailDialogProps {
  issue: IssueTask | null;
  allStaff: Staff[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
    const [assignedStaffId, setAssignedStaffId] = useState<string>("unassigned");
    const [receptionNotes, setReceptionNotes] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false); // New state for edit mode

    // Store initial values when issue loads or editing starts/cancels
    const [initialStaffId, setInitialStaffId] = useState<string>("unassigned");
    const [initialNotes, setInitialNotes] = useState<string>("");

    const resetToInitialState = useCallback(() => {
        if (issue) {
            const staffId = issue.user?.id || "unassigned";
            const notes = issue.reception_notes || "";
            setAssignedStaffId(staffId);
            setReceptionNotes(notes);
            setInitialStaffId(staffId); // Store initial values
            setInitialNotes(notes);
        } else {
            setAssignedStaffId("unassigned");
            setReceptionNotes("");
            setInitialStaffId("unassigned");
            setInitialNotes("");
        }
        setIsEditing(false); // Always reset editing mode
    }, [issue]);

    // Update state when the selected issue changes or dialog opens/closes
    useEffect(() => {
        if (isOpen) {
           resetToInitialState();
        } else {
            // Optionally reset state completely when closed, though resetToInitialState handles it on open
            setIsEditing(false);
        }
    }, [isOpen, issue, resetToInitialState]);

    const handleSaveChanges = async () => {
        if (!issue) return;
        setIsSaving(true);
        const updates: Partial<{ issue_flag: boolean | null; reception_notes: string | null; user_id: string | null }> = {
            user_id: assignedStaffId === "unassigned" ? null : assignedStaffId,
            reception_notes: receptionNotes || null,
        };

        // Optionally add validation for notes length here too
         if (receptionNotes && receptionNotes.length > 2000) {
              // Consider showing a toast here as well
              console.error("Reception notes cannot exceed 2000 characters.");
              setIsSaving(false);
              return; // Prevent saving
         }

        const success = await onUpdate(issue.id, updates);
        setIsSaving(false);
        if (success) {
            setIsEditing(false); // Exit editing mode on successful save
            // Update initial state to reflect saved changes
            setInitialStaffId(assignedStaffId);
            setInitialNotes(receptionNotes);
        }
        // Keep editing mode on failure
    };

    const handleMarkFixed = async () => {
         if (!issue) return;
         setIsSaving(true);
         const updates = { issue_flag: false };
         const success = await onUpdate(issue.id, updates);
         setIsSaving(false);
         if (success) {
             onOpenChange(false); // Close dialog
         }
    };

    const handleCancelEdit = () => {
        // Reset state to initial values before editing started
        setAssignedStaffId(initialStaffId);
        setReceptionNotes(initialNotes);
        setIsEditing(false);
    };

    const formatDate = (dateString: string | null) => {
      if (!dateString) return "N/A";
      // Adding 'T00:00:00Z' ensures consistent parsing as UTC date part
      return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' // Specify UTC for display consistency
      });
    };

    const getIssueStatusBadge = (isIssue: boolean | null): React.ReactNode => {
      if (isIssue === true) {
          return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">To Fix</Badge>;
      }
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">Fixed</Badge>;
    };

    if (!issue) return null;

    const currentIssueStatus: IssueDisplayStatus = issue.issue_flag === true ? 'To Fix' : 'Fixed';
    // Disable editing actions entirely if the issue is marked as fixed
    const isFixed = currentIssueStatus === 'Fixed';

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

                {/* Main Content Area */}
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
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
                     <div className="grid grid-cols-1 gap-4 items-end">
                         <div className="space-y-1">
                            <Label htmlFor="issue-assignee">Assign Staff</Label>
                             <Select
                                value={assignedStaffId}
                                onValueChange={setAssignedStaffId}
                                // Disable if not editing OR if issue is fixed
                                disabled={isSaving || !isEditing || isFixed}
                             >
                                <SelectTrigger id="issue-assignee" className={!isEditing && !isFixed ? "cursor-default" : ""}>
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
                            placeholder={!isEditing ? "No reception notes." : "Add notes for maintenance or housekeeping..."}
                             // Disable if not editing OR if issue is fixed
                            disabled={isSaving || !isEditing || isFixed}
                            // Make read-only visually when not editing
                            readOnly={!isEditing}
                            maxLength={2000}
                        />
                         {isEditing && ( // Only show counter when editing
                            <p className="text-xs text-muted-foreground text-right">{receptionNotes.length} / 2000</p>
                         )}
                    </div>
                </div>

                {/* Footer Buttons */}
                <DialogFooter className="justify-between sm:justify-between flex-wrap gap-2"> {/* Added flex-wrap and gap */}
                    {/* Left Side: Mark Fixed Button (only if active and not editing) */}
                    <div> {/* Wrapper div for alignment */}
                        {!isEditing && currentIssueStatus === 'To Fix' && (
                            <Button
                                type="button"
                                variant="default"
                                onClick={handleMarkFixed}
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <CheckSquare className="mr-2 h-4 w-4" /> Mark as Fixed
                            </Button>
                        )}
                         {currentIssueStatus === 'Fixed' && (
                           <span className="text-sm text-green-700 font-medium inline-flex items-center">
                                <CheckSquare className="mr-2 h-4 w-4" /> Issue Fixed
                            </span>
                         )}
                    </div>

                    {/* Right Side: Cancel/Edit or Cancel/Save Changes */}
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">Close</Button>
                                </DialogClose>
                                {/* Show Edit button only if issue is not fixed */}
                                {!isFixed && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => setIsEditing(true)}
                                    >
                                         <Edit className="mr-2 h-4 w-4" /> Edit
                                    </Button>
                                )}
                            </>
                        ) : (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSaveChanges}
                                    disabled={isSaving}
                                >
                                     <Save className="mr-2 h-4 w-4" />
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </Button>
                            </>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
