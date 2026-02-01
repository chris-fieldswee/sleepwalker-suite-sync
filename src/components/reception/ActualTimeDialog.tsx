// src/components/reception/ActualTimeDialog.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ActualTimeDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (actualTime: number | null) => void;
  initialValue?: number | null;
  isSubmitting?: boolean;
}

export function ActualTimeDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  initialValue = null,
  isSubmitting = false,
}: ActualTimeDialogProps) {
  const [value, setValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue !== null ? String(initialValue) : "");
      setError(null);
    }
  }, [isOpen, initialValue]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed === "") {
      setError("Proszę podać czas.");
      return;
    }
    const num = parseInt(trimmed, 10);
    if (isNaN(num) || num < 0) {
      setError("Czas musi być liczbą nieujemną (minuty).");
      return;
    }
    setError(null);
    onConfirm(num);
  };

  const handleCancel = () => {
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rzeczywisty czas wykonania</DialogTitle>
          <DialogDescription>
            Zadanie zostało zamknięte. Podaj rzeczywisty czas wykonania (minuty):
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="actual-time-input">Czas (minuty)</Label>
            <Input
              id="actual-time-input"
              type="number"
              min={0}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder="np. 45"
              disabled={isSubmitting}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Anuluj
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
