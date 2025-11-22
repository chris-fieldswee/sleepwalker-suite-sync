// src/components/reception/ReportNewIssueDialog.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Room } from '@/hooks/useReceptionData';

interface ReportNewIssueDialogProps {
    availableRooms: Room[];
    onSubmit: (roomId: string, description: string, photo: File | null) => Promise<boolean>; // Returns true on success
    isSubmitting: boolean;
    triggerButton?: React.ReactNode;
}

export function ReportNewIssueDialog({
    availableRooms,
    onSubmit,
    isSubmitting,
    triggerButton
}: ReportNewIssueDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [roomId, setRoomId] = useState<string>("");
    const [description, setDescription] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const { toast } = useToast();
    const prevIsOpen = useRef(isOpen);

    // Reset state when dialog opens
    useEffect(() => {
        if (!prevIsOpen.current && isOpen) {
            setRoomId(availableRooms.length > 0 ? availableRooms[0].id : "");
            setDescription("");
            setPhoto(null);
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview); // Clean up previous preview
            }
            setPhotoPreview(null);
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, availableRooms, photoPreview]); // Add photoPreview dependency for cleanup

    // Clean up preview URL on unmount
    useEffect(() => {
        return () => {
            if (photoPreview) {
                URL.revokeObjectURL(photoPreview);
            }
        };
    }, [photoPreview]);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;

        // Clean up previous object URL
        if (photoPreview) {
            URL.revokeObjectURL(photoPreview);
        }

        if (file && file.type.startsWith("image/")) {
            setPhoto(file);
            try {
                setPhotoPreview(URL.createObjectURL(file));
            } catch (error) {
                console.error("Error creating object URL for preview:", error);
                setPhotoPreview(null);
                toast({ title: "Błąd Podglądu", description: "Nie udało się utworzyć podglądu zdjęcia.", variant: "destructive" });
            }
        } else {
            if (file) {
                toast({ title: "Nieprawidłowy Plik", description: "Proszę wybrać plik obrazu.", variant: "destructive" });
                e.target.value = ''; // Clear the input
            }
            setPhoto(null);
            setPhotoPreview(null);
        }
    };

    const handleSubmit = async () => {
        if (!roomId) {
            toast({ title: "Brak Pokoju", description: "Proszę wybrać pokój.", variant: "destructive" });
            return;
        }
        if (!description.trim()) {
            toast({ title: "Brak Opisu", description: "Proszę opisać problem.", variant: "destructive" });
            return;
        }
        if (description.length > 5000) {
            toast({ title: "Opis Zbyt Długi", description: "Opis musi mieć mniej niż 5000 znaków.", variant: "destructive" });
            return;
        }

        const success = await onSubmit(roomId, description, photo);
        if (success) {
            setIsOpen(false); // Close dialog on success
        }
        // Keep dialog open on failure
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {triggerButton ? (
                <DialogTrigger onClick={() => setIsOpen(true)} asChild>
                    {/* Wrap trigger button to ensure it's clickable */}
                    <span>{triggerButton}</span>
                </DialogTrigger>
            ) : (
                <DialogTrigger asChild>
                    <Button variant="outline">Zgłoś Nowy Problem</Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Zgłoś Nowy Problem Techniczny</DialogTitle>
                    <DialogDescription>Wybierz pokój, opisz problem i opcjonalnie dodaj zdjęcie.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Room Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="issue-room-modal" className="text-right">Pokój*</Label>
                        <Select value={roomId} onValueChange={setRoomId} required>
                            <SelectTrigger id="issue-room-modal" className="col-span-3">
                                <SelectValue placeholder="Wybierz pokój" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableRooms.map(room => (
                                    <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Description Textarea */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="issue-description-modal" className="text-right">Opis*</Label>
                        <Textarea
                            id="issue-description-modal"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="col-span-3 min-h-[80px]"
                            placeholder="Np. Cieknący kran w łazience..."
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Photo Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="issue-photo-modal" className="text-right">Zdjęcie</Label>
                        <Input
                            id="issue-photo-modal"
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoSelect}
                            className="col-span-3"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Photo Preview */}
                    {photoPreview && (
                        <div className="col-span-4 mt-2 text-center">
                            <img src={photoPreview} alt="Issue preview" className="max-h-40 w-auto object-contain rounded border inline-block" />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Anuluj</Button></DialogClose>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !roomId || !description.trim()}
                    >
                        {isSubmitting ? "Zgłaszanie..." : "Zgłoś Problem"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
