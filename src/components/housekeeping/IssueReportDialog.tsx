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
        toast({ title: "Błąd Podglądu", description: "Nie można utworzyć podglądu zdjęcia.", variant: "destructive" })
      }
    } else {
      if (file) {
        toast({ title: "Nieprawidłowy Plik", description: "Proszę wybrać plik obrazu.", variant: "destructive" })
        e.target.value = ''; // Clear the input
      }
      setIssuePhoto(null);
      // Keep existing non-blob URL if no new file selected, otherwise clear
      setIssuePhotoPreview(p => p && p.startsWith('blob:') ? null : p);
    }
  };

  const handleReportClick = async () => {
    if (!issueDescription.trim()) {
      toast({ title: "Brak Opisu", description: "Proszę opisać problem.", variant: "destructive" });
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
        <DialogTitle>Zgłoś Problem dla Pokoju {task.room?.name || 'Nieznany'}</DialogTitle>
        <DialogDescription>Opisz problem konserwacyjny i opcjonalnie dodaj zdjęcie. Oznaczy to zadanie jako wymagające naprawy.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-1">
          <Label htmlFor={`issueDescription-${task.id}`}>Opis*</Label>
          <Textarea
            id={`issueDescription-${task.id}`}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="min-h-[80px]"
            placeholder="Np. cieknący kran w umywalce łazienkowej..."
            required
            disabled={isReporting}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`issuePhoto-${task.id}`}>Zdjęcie (Opcjonalnie)</Label>
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
            <img src={issuePhotoPreview} alt="Issue preview" className="max-h-40 w-auto object-contain rounded border inline-block" />
            <p className="text-xs text-muted-foreground mt-1">{issuePhoto ? `Wybrano nowe zdjęcie` : "Istniejące zdjęcie"}</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary" disabled={isReporting}>Anuluj</Button></DialogClose>
        <Button type="button" variant="destructive" onClick={handleReportClick} disabled={isReporting || !issueDescription.trim()}>
          {isReporting ? "Zgłaszanie..." : "Zgłoś Problem"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
