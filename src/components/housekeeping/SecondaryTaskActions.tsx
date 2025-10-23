// src/components/housekeeping/SecondaryTaskActions.tsx
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, AlertTriangle } from "lucide-react";
import { NoteDialog } from './NoteDialog';
import { IssueReportDialog } from './IssueReportDialog';
import type { Task } from '@/pages/Housekeeping'; // Assuming Task type is exported or moved

interface SecondaryTaskActionsProps {
  task: Task;
  onSaveNote: (taskId: string, note: string) => Promise<boolean>;
  onReportIssue: (taskId: string, description: string, photo: File | null) => Promise<boolean>;
}

export function SecondaryTaskActions({ task, onSaveNote, onReportIssue }: SecondaryTaskActionsProps) {
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-accent px-2">
            <MessageSquare className="mr-1 h-4 w-4" /> Note
          </Button>
        </DialogTrigger>
        {/* Render dialog only when open to ensure fresh initial state */}
        {isNoteDialogOpen && (
            <NoteDialog
              task={task}
              initialNote={task.housekeeping_notes || ""}
              onSave={onSaveNote}
              onClose={() => setIsNoteDialogOpen(false)} // Pass handler to close
            />
        )}
      </Dialog>

      {/* Report Issue Dialog - Hide if already flagged */}
      {!task.issue_flag && (
        <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 px-2">
              <AlertTriangle className="mr-1 h-4 w-4" /> Report Issue
            </Button>
          </DialogTrigger>
          {/* Render dialog only when open */}
          {isIssueDialogOpen && (
            <IssueReportDialog
              task={task}
              onReport={onReportIssue}
              onClose={() => setIsIssueDialogOpen(false)} // Pass handler to close
            />
          )}
        </Dialog>
      )}
    </div>
  );
}
