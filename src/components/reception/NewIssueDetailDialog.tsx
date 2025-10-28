// src/components/reception/NewIssueDetailDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, User, CalendarDays, AlertTriangle, Image as ImageIcon, Edit2, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Staff } from '@/hooks/useReceptionData';

type Issue = Database["public"]["Tables"]["issues"]["Row"];
type IssueWithRelations = Issue & {
  room: { id: string; name: string; color: string | null };
  assigned_to?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
  reported_by?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
  resolved_by?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
  task?: { id: string; date: string } | null;
};

interface IssueDetailDialogProps {
  issue: IssueWithRelations | null;
  allStaff: Staff[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

// Filter staff to only show reception and admin users
const getFilteredStaff = (allStaff: Staff[]) => {
  return allStaff.filter(staff => {
    const role = staff.role?.toLowerCase();
    return role === 'reception' || role === 'admin';
  });
};

export function IssueDetailDialog({
    issue,
    allStaff,
    isOpen,
    onOpenChange,
    onUpdate
}: IssueDetailDialogProps) {
    const { toast } = useToast();
    const [isEditMode, setIsEditMode] = useState(false);
    const [assignedStaffId, setAssignedStaffId] = useState<string>("unassigned");
    const [status, setStatus] = useState<string>('open');
    const [priority, setPriority] = useState<string>('medium');
    const [notes, setNotes] = useState<string>("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Update state when the selected issue changes
    useEffect(() => {
        if (issue) {
            setIsEditMode(false);
            setAssignedStaffId(issue.assigned_to_user_id || "unassigned");
            setStatus(issue.status);
            setPriority(issue.priority);
            setNotes(issue.notes || "");
            setPhoto(null);
            setPhotoPreview(issue.photo_url || null);
        } else {
            // Reset when dialog closes or issue becomes null
            setIsEditMode(false);
            setAssignedStaffId("unassigned");
            setStatus('open');
            setPriority('medium');
            setNotes("");
            setPhoto(null);
            setPhotoPreview(null);
        }
    }, [issue]);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        
        if (photoPreview && !issue?.photo_url) {
            URL.revokeObjectURL(photoPreview);
        }

        if (file && file.type.startsWith("image/")) {
            setPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
        } else if (file) {
            toast({
                title: "Invalid File",
                description: "Please select an image file.",
                variant: "destructive",
            });
            e.target.value = '';
        }
    };

    const handleSave = async () => {
        if (!issue) return;
        
        setIsSaving(true);
        
        try {
            let photoUrl = issue.photo_url;
            
            // Upload new photo if one was selected
            if (photo) {
                const { data: authData } = await supabase.auth.getUser();
                const userId = authData?.user?.id;
                
                if (!userId) {
                    throw new Error("User not authenticated");
                }
                
                const fileExt = photo.name.split('.').pop();
                const fileName = `${issue.id}/${Date.now()}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('issue-photos')
                    .upload(fileName, photo, { upsert: true });
                
                if (uploadError) throw uploadError;
                
                const { data: { publicUrl } } = supabase.storage
                    .from('issue-photos')
                    .getPublicUrl(fileName);
                    
                photoUrl = publicUrl;
            }
            
            const { error } = await supabase
                .from('issues')
                .update({
                    assigned_to_user_id: assignedStaffId === "unassigned" ? null : assignedStaffId,
                    status: status as any,
                    priority: priority as any,
                    notes: notes || null,
                    photo_url: photoUrl,
                })
                .eq('id', issue.id);

            if (error) throw error;

            toast({
                title: "Success",
                description: "Issue updated successfully",
            });
            
            onUpdate();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error updating issue:", error);
            toast({
                title: "Error",
                description: `Failed to update issue: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (!issue) return null;

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

    const getStatusBadge = (status: string) => {
        const config: Record<string, { label: string; className: string }> = {
            open: { label: 'Open', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
            in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
            resolved: { label: 'Resolved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
            closed: { label: 'Closed', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200' },
        };
        const { label, className } = config[status] || { label: status, className: '' };
        return <Badge className={className}>{label}</Badge>;
    };

    const getPriorityBadge = (priority: string) => {
        const config: Record<string, { label: string; className: string }> = {
            low: { label: 'Low', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
            medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
            high: { label: 'High', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' },
            urgent: { label: 'Urgent', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
        };
        const { label, className } = config[priority] || { label: priority, className: '' };
        return <Badge className={className}>{label}</Badge>;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle>Issue Details - {issue.room.name}</DialogTitle>
                            <DialogDescription>
                                {formatDate(issue.reported_at)} · {issue.title}
                            </DialogDescription>
                        </div>
                        <div className="flex gap-2 items-center">
                            {getStatusBadge(isEditMode ? status : issue.status)}
                            {getPriorityBadge(isEditMode ? priority : issue.priority)}
                            {!isEditMode && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditMode(true)}
                                    className="h-8"
                                >
                                    <Edit2 className="h-4 w-4 mr-1" />
                                    Edit
                                </Button>
                            )}
                            {isEditMode && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsEditMode(false)}
                                    className="h-8"
                                >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Description */}
                    <div className="space-y-1">
                        <Label className="text-muted-foreground">Description</Label>
                        <p className="text-sm border p-3 rounded bg-muted/30 min-h-[60px]">
                            {issue.description || <span className="italic text-muted-foreground/70">No description provided.</span>}
                        </p>
                    </div>

                    {/* Reported Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <Label className="text-muted-foreground flex items-center gap-1">
                                <CalendarDays className="h-4 w-4" /> Reported
                            </Label>
                            <p className="text-sm border p-2 rounded bg-muted/30">
                                {formatDate(issue.reported_at)}
                            </p>
                        </div>
                        {issue.reported_by && (
                            <div className="space-y-1">
                                <Label className="text-muted-foreground flex items-center gap-1">
                                    <User className="h-4 w-4" /> Reported By
                                </Label>
                                <p className="text-sm border p-2 rounded bg-muted/30">
                                    {getDisplayName(issue.reported_by)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Assigned Staff */}
                    <div className="space-y-1">
                        <Label className="flex items-center gap-1 text-muted-foreground">
                            <User className="h-4 w-4" /> Assigned To
                        </Label>
                        {!isEditMode ? (
                            <p className="text-sm border p-2 rounded bg-muted/30">
                                {issue.assigned_to ? getDisplayName(issue.assigned_to) : <span className="italic text-muted-foreground/70">Unassigned</span>}
                            </p>
                        ) : (
                            <Select value={assignedStaffId} onValueChange={setAssignedStaffId} disabled={isSaving || !isEditMode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select staff..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {getFilteredStaff(allStaff).map(staff => (
                                    <SelectItem key={staff.id} value={staff.id}>
                                      {staff.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Status */}
                    <div className="space-y-1">
                        <Label className="flex items-center gap-1 text-muted-foreground">
                            <AlertTriangle className="h-4 w-4" /> Status
                        </Label>
                        {!isEditMode ? (
                            <p className="text-sm border p-2 rounded bg-muted/30">
                                {issue.status === 'open' ? 'Open' : issue.status === 'in_progress' ? 'In Progress' : issue.status === 'resolved' ? 'Resolved' : 'Closed'}
                            </p>
                        ) : (
                            <Select value={status} onValueChange={setStatus} disabled={isSaving || !isEditMode}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="open">Open</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Priority */}
                    <div className="space-y-1">
                        <Label className="flex items-center gap-1 text-muted-foreground">Priority</Label>
                        {!isEditMode ? (
                            <p className="text-sm border p-2 rounded bg-muted/30">
                                {issue.priority === 'low' ? 'Low' : issue.priority === 'medium' ? 'Medium' : issue.priority === 'high' ? 'High' : 'Urgent'}
                            </p>
                        ) : (
                            <Select value={priority} onValueChange={setPriority} disabled={isSaving || !isEditMode}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Photo Upload */}
                    {!isEditMode ? (
                        issue.photo_url ? (
                            <div className="space-y-1">
                                <Label className="flex items-center gap-1 text-muted-foreground">
                                    <ImageIcon className="h-4 w-4" /> Photo
                                </Label>
                                <div className="border rounded p-2 bg-muted/30">
                                    <img
                                        src={issue.photo_url}
                                        alt="Issue"
                                        className="max-h-32 w-auto mx-auto object-contain rounded"
                                    />
                                </div>
                            </div>
                        ) : null
                    ) : (
                        <div className="space-y-1">
                            <Label className="flex items-center gap-1 text-muted-foreground">
                                <ImageIcon className="h-4 w-4" /> Photo
                            </Label>
                            <Input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoSelect}
                                disabled={isSaving || !isEditMode}
                            />
                            {photoPreview && (
                                <div className="mt-2 border rounded p-2 bg-muted/30">
                                    <img
                                        src={photoPreview}
                                        alt="Issue preview"
                                        className="max-h-32 w-auto mx-auto object-contain rounded"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-1">
                        <Label className="flex items-center gap-1 text-muted-foreground">Notes</Label>
                        {!isEditMode ? (
                            <p className="text-sm border p-2 rounded bg-muted/30 min-h-[60px]">
                                {issue.notes || <span className="italic text-muted-foreground/70">No notes added.</span>}
                            </p>
                        ) : (
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[80px]"
                                placeholder="Add any additional notes..."
                                disabled={isSaving || !isEditMode}
                            />
                        )}
                    </div>

                    {issue.resolved_at && (
                        <div className="space-y-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3">
                            <Label className="flex items-center gap-1 text-green-700 dark:text-green-300">
                                <CheckSquare className="h-4 w-4" /> Resolved
                            </Label>
                            <p className="text-sm text-green-600 dark:text-green-400">
                                Resolved on {formatDate(issue.resolved_at)}
                                {issue.resolved_by && ` by ${getDisplayName(issue.resolved_by)}`}
                            </p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    {!isEditMode ? (
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Close
                            </Button>
                        </DialogClose>
                    ) : (
                        <>
                            <Button 
                                type="button" 
                                variant="secondary" 
                                onClick={() => {
                                    setIsEditMode(false);
                                    // Reset state to original issue values
                                    if (issue) {
                                        setAssignedStaffId(issue.assigned_to_user_id || "unassigned");
                                        setStatus(issue.status);
                                        setPriority(issue.priority);
                                        setNotes(issue.notes || "");
                                        setPhoto(null);
                                        setPhotoPreview(issue.photo_url || null);
                                    }
                                }}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

