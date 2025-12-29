// src/components/reception/ReportNewIssueDialog.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
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

        if (file) {
            // Check if it's an image file (including SVG)
            const isValidImage = file.type.startsWith("image/") || 
                                 file.type === "image/svg+xml" ||
                                 /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
            
            if (isValidImage) {
                setPhoto(file);
                try {
                    setPhotoPreview(URL.createObjectURL(file));
                } catch (error) {
                    console.error("Error creating object URL for preview:", error);
                    setPhotoPreview(null);
                    toast({ title: "Błąd Podglądu", description: "Nie udało się utworzyć podglądu zdjęcia.", variant: "destructive" });
                }
            } else {
                toast({ title: "Nieprawidłowy Plik", description: "Proszę wybrać plik obrazu (JPG, PNG, WebP, SVG).", variant: "destructive" });
                e.target.value = ''; // Clear the input
                setPhoto(null);
                setPhotoPreview(null);
            }
        } else {
            setPhoto(null);
            setPhotoPreview(null);
        }
    };

    const handleRemovePhoto = () => {
        if (photoPreview) {
            URL.revokeObjectURL(photoPreview);
        }
        setPhoto(null);
        setPhotoPreview(null);
        // Reset the file input
        const fileInput = document.getElementById("issue-photo-modal") as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
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
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                    <DialogTitle>Zgłoś nowy problem techniczny</DialogTitle>
                    <DialogDescription>Wybierz pokój, opisz problem i opcjonalnie dodaj zdjęcie.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 px-6 py-4 overflow-y-auto flex-1 min-h-0">
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
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label htmlFor="issue-description-modal" className="text-right pt-2">Opis*</Label>
                        <Textarea
                            id="issue-description-modal"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="col-span-3 min-h-[100px]"
                            placeholder="Np. Cieknący kran w łazience..."
                            required
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Photo Section */}
                    <div className="grid grid-cols-4 gap-4">
                        <Label htmlFor="issue-photo-modal" className="text-right pt-2">Zdjęcie</Label>
                        <div className="col-span-3 space-y-3">
                            <Input
                                id="issue-photo-modal"
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoSelect}
                                disabled={isSubmitting}
                            />
                            
                            {/* Photo Preview */}
                            {photoPreview && (
                                <div className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-4">
                                    <div className="relative inline-block max-w-full">
                                        <img 
                                            src={photoPreview} 
                                            alt="Podgląd zdjęcia" 
                                            className="max-h-[300px] w-auto max-w-full object-contain rounded-md"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                                            onClick={handleRemovePhoto}
                                            disabled={isSubmitting}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter className="px-6 py-4 border-t mt-auto">
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
