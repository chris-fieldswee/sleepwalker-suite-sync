// src/components/reception/WorkLogDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Clock, Edit2, Check, X } from "lucide-react";
import type { Staff, WorkLog } from '@/hooks/useReceptionData'; // Import types
import { formatTimeForInput } from '@/lib/utils'; // Import helper

interface WorkLogDialogProps {
    filterDate: string;
    workLogs: WorkLog[];
    allStaff: Staff[];
    onSave: (logData: Partial<WorkLog> & { user_id: string }) => Promise<boolean>; // Returns true on success
    isSaving: boolean;
    triggerButton?: React.ReactNode; // Optional custom trigger
}

// Define the shape of the data being edited
type EditingLogState = Partial<WorkLog> & { user_id: string; time_in?: string; time_out?: string };


export function WorkLogDialog({
    filterDate,
    workLogs,
    allStaff,
    onSave,
    isSaving,
    triggerButton
}: WorkLogDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<EditingLogState | null>(null);

     // Function to prepare log data for editing state
    const prepareLogForEditing = (staffMember: Staff): EditingLogState => {
        const log = workLogs.find(l => l.user_id === staffMember.id);
        return {
            id: log?.id,
            user_id: staffMember.id,
            time_in: formatTimeForInput(log?.time_in), // Format for time input
            time_out: formatTimeForInput(log?.time_out), // Format for time input
            break_minutes: log?.break_minutes ?? 0,
            notes: log?.notes ?? "",
        };
    };

    const handleSaveClick = async () => {
        if (!editingLog) return;
        const success = await onSave(editingLog);
        if (success) {
            setEditingLog(null); // Exit editing mode on success
        }
        // Keep editing mode on failure
    };

    // When the dialog closes, ensure editing state is reset
    useEffect(() => {
        if (!isOpen) {
            setEditingLog(null);
        }
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {triggerButton || <Button variant="outline" size="sm"> <Clock className="mr-2 h-4 w-4" /> Work Logs </Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] md:max-w-[750px] lg:max-w-[900px]">
                <DialogHeader>
                    <DialogTitle>Staff Work Logs for {new Date(filterDate + 'T00:00:00Z').toLocaleDateString()}</DialogTitle> {/* Ensure date is parsed correctly */}
                    <DialogDescription> Enter or update staff sign-in/out times, breaks, and notes. Times are in local timezone. </DialogDescription>
                </DialogHeader>
                <div className="mt-4 max-h-[60vh] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[150px]">Staff</TableHead>
                                <TableHead className="w-[120px]">Time In</TableHead>
                                <TableHead className="w-[120px]">Time Out</TableHead>
                                <TableHead className="w-[100px]">Break (min)</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="w-[100px] text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allStaff.map((staffMember) => {
                                const isEditing = editingLog?.user_id === staffMember.id;
                                // Use editingLog if editing, otherwise prepare display data
                                const displayLog = isEditing ? editingLog : prepareLogForEditing(staffMember);

                                return (
                                    <TableRow key={staffMember.id}>
                                        <TableCell className="font-medium">{staffMember.name}</TableCell>
                                        <TableCell>
                                            {isEditing ? (
                                                <Input type="time" value={displayLog.time_in || ""} onChange={(e) => setEditingLog({...displayLog, time_in: e.target.value})} className="w-full h-9" disabled={isSaving}/>
                                            ) : (displayLog.time_in || "-") }
                                        </TableCell>
                                        <TableCell>
                                             {isEditing ? (
                                                <Input type="time" value={displayLog.time_out || ""} onChange={(e) => setEditingLog({...displayLog, time_out: e.target.value})} className="w-full h-9" disabled={isSaving}/>
                                             ) : (displayLog.time_out || "-") }
                                        </TableCell>
                                        <TableCell>
                                             {isEditing ? (
                                                <Input type="number" value={displayLog.break_minutes ?? 0} onChange={(e) => setEditingLog({...displayLog, break_minutes: parseInt(e.target.value, 10) || 0})} min="0" className="w-full h-9" disabled={isSaving}/>
                                             ) : (displayLog.break_minutes ?? 0) }
                                         </TableCell>
                                        <TableCell>
                                             {isEditing ? (
                                                <Input type="text" value={displayLog.notes || ""} onChange={(e) => setEditingLog({...displayLog, notes: e.target.value})} className="w-full h-9" disabled={isSaving}/>
                                             ) : (<span className="text-xs">{displayLog.notes || "-"}</span>) }
                                         </TableCell>
                                        <TableCell className="text-center">
                                            {isEditing ? (
                                                <div className="flex gap-1 justify-center">
                                                    <Button size="icon" className="h-8 w-8" onClick={handleSaveClick} disabled={isSaving}> <Check className="h-4 w-4"/> <span className="sr-only">Save</span> </Button>
                                                    <Button size="icon" className="h-8 w-8" variant="outline" onClick={() => setEditingLog(null)} disabled={isSaving}> <X className="h-4 w-4"/> <span className="sr-only">Cancel</span> </Button>
                                                </div>
                                            ) : (
                                                <Button size="icon" className="h-8 w-8 mx-auto" variant="ghost" onClick={() => setEditingLog(prepareLogForEditing(staffMember))}> <Edit2 className="h-4 w-4"/> <span className="sr-only">Edit</span> </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <DialogClose asChild> <Button type="button" variant="secondary">Close</Button> </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
