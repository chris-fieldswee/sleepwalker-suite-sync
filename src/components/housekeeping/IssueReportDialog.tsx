// src/components/housekeeping/IssueReportDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Task } from '@/pages/Housekeeping'; // Assuming Task type is exported or moved

interface IssueReportDialogProps {
  task: Task;
  onReport: (taskId: string, description: string, photo: File | null) => Promise<boolean>; // Returns true on success
  onClose: () => void;
}

export function IssueReportDialog({ task, onReport, onClose }: IssueReportDialogProps) {
  const [issueDescription, setIssueDescription] = useState(task.issue_description || "");
  const [issuePhoto, setIssuePhoto] = useState<File | null>(null);
  const [issuePhotoPreview, setIssuePhotoPreview] = useState<string | null>(task.issue_photo || null);
  const [isReporting, setIsReporting] = useState(false);
  const { toast } = useToast();

  // Clean up preview URL on unmount
  useEffect(() => {
    // Only revoke if it's an object URL (starts with blob:)
    const isObjectURL = issuePhotoPreview?.startsWith('blob:');
    return () => {
      if (issuePhotoPreview && isObjectURL) {
        URL.revokeObjectURL(issuePhotoPreview);
      }
    };
  }, [issuePhotoPreview]);


  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;

    // Clean up previous *object* URL
    if (issuePhotoPreview && issuePhotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(issuePhotoPreview);
    }

    if (file && file.type.startsWith("image/")) {
      setIssuePhoto(file);
      try {
        setIssuePhotoPreview(URL.createObjectURL(file));
      } catch (error) {
         console.error("Error creating object URL for preview:", error);
         setIssuePhotoPreview(null);
         toast({title:"Preview Error", description: "Could not create image preview.", variant: "destructive"})
      }
    } else {
      if (file) {
         toast({title:"Invalid File", description: "Please select an image file.", variant: "destructive"})
         e.target.value = ''; // Clear the input
      }
      setIssuePhoto(null);
      // Keep existing non-blob URL if no new file selected, otherwise clear
      setIssuePhotoPreview(p => p && p.startsWith('blob:') ? null : p);
    }
  };

  const handleReportClick = async () => {
    if (!issueDescription.trim()) {
        toast({ title: "Missing Description", description: "Please describe the issue.", variant: "destructive" });
        return;
    }
    setIsReporting(true);
    const success = await onReport(task.id, issueDescription, issuePhoto);
    setIsReporting(false);
    if (success) {
      onClose(); // Close dialog on successful report
    }
    // Keep dialog open on failure
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Report Issue for Room {task.room?.name || 'Unknown'}</DialogTitle>
        <DialogDescription>Describe the maintenance issue and optionally add a photo. This will mark the task as needing repair.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-1">
          <Label htmlFor={`issueDescription-${task.id}`}>Description*</Label>
          <Textarea
            id={`issueDescription-${task.id}`}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="min-h-[80px]"
            placeholder="E.g., Leaking faucet in bathroom sink..."
            required
            disabled={isReporting}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`issuePhoto-${task.id}`}>Photo (Optional)</Label>
          <Input
            id={`issuePhoto-${task.id}`}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            disabled={isReporting}
          />
        </div>
        {issuePhotoPreview && (
          <div className="mt-2 text-center">
            <img src={issuePhotoPreview} alt="Issue preview" className="max-h-40 w-auto object-contain rounded border inline-block"/>
            <p className="text-xs text-muted-foreground mt-1">{issuePhoto ? `New photo selected` : "Existing photo"}</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary" disabled={isReporting}>Cancel</Button></DialogClose>
        <Button type="button" variant="destructive" onClick={handleReportClick} disabled={isReporting || !issueDescription.trim()}>
          {isReporting ? "Reporting..." : "Report Issue"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
