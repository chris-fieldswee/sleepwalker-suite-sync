// src/components/housekeeping/NoteDialog.tsx
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Task } from '@/pages/Housekeeping'; // Assuming Task type is exported or moved

interface NoteDialogProps {
  task: Task;
  initialNote: string;
  onSave: (taskId: string, note: string) => Promise<boolean>; // Returns true on success
  onClose: () => void; // Function to manually close dialog if needed
}

export function NoteDialog({ task, initialNote, onSave, onClose }: NoteDialogProps) {
  const [currentNote, setCurrentNote] = useState(initialNote);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveClick = async () => {
    setIsSaving(true);
    const success = await onSave(task.id, currentNote);
    setIsSaving(false);
    if (success) {
      onClose(); // Close dialog on successful save
    }
    // If save fails, the dialog remains open for the user to retry or cancel
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Note for Room {task.room?.name || 'Unknown'}</DialogTitle>
        <DialogDescription>Add or update housekeeping notes (e.g., lost & found, specific observations).</DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <Label htmlFor={`note-${task.id}`} className="sr-only">Note Content</Label>
        <Textarea
          id={`note-${task.id}`}
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          className="min-h-[100px]"
          placeholder="E.g., Extra towels requested, guest left wallet..."
          disabled={isSaving}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary" disabled={isSaving}>Cancel</Button></DialogClose>
        <Button type="button" onClick={handleSaveClick} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Note"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
