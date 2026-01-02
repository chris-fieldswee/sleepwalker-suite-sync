import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EditAvailabilityDialogProps {
  availability: {
    id: string;
    staff_id: string;
    date: string;
    total_hours: number;
    position: string | null;
    location: string | null;
    start_time: string | null;
    end_time: string | null;
    staff: {
      id: string;
      name: string;
      first_name: string | null;
      last_name: string | null;
      role: string;
    } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onEditComplete?: () => void;
}

type User = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
};

export const EditAvailabilityDialog: React.FC<EditAvailabilityDialogProps> = ({
  availability,
  isOpen,
  onClose,
  onEditComplete
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    staff_id: '',
    date: '',
    total_hours: '',
    position: '',
    location: '',
    start_time: '',
    end_time: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (availability && isOpen) {
      // Format time values for input fields (HH:MM format)
      const formatTimeForInput = (time: string | null) => {
        if (!time) return '';
        // If time is already in HH:MM format, return as is
        if (time.length === 5 && time.includes(':')) {
          return time;
        }
        // Otherwise, try to parse and format
        return time.substring(0, 5);
      };

      setFormData({
        staff_id: availability.staff_id,
        date: availability.date,
        total_hours: availability.total_hours.toString(),
        position: availability.position || '',
        location: availability.location || '',
        start_time: formatTimeForInput(availability.start_time),
        end_time: formatTimeForInput(availability.end_time),
      });
    }
  }, [availability, isOpen]);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, first_name, last_name, role')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać listy pracowników",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.staff_id || !formData.date || !formData.total_hours) {
      toast({
        title: "Błąd",
        description: "Proszę wypełnić wszystkie wymagane pola",
        variant: "destructive",
      });
      return;
    }

    // Validate that date is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (formData.date < today) {
      toast({
        title: "Błąd",
        description: "Nie można edytować dostępności dla dat z przeszłości. Tylko dzisiejsza i przyszłe daty są dozwolone.",
        variant: "destructive",
      });
      return;
    }

    const totalHours = parseFloat(formData.total_hours);
    if (isNaN(totalHours) || totalHours <= 0) {
      toast({
        title: "Błąd",
        description: "Suma godzin musi być liczbą większą od zera",
        variant: "destructive",
      });
      return;
    }

    if (!availability) return;

    setIsSaving(true);
    try {
      const availabilityData = {
        staff_id: formData.staff_id,
        date: formData.date,
        total_hours: totalHours,
        position: formData.position || null,
        location: formData.location || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
      };

      const { error } = await supabase
        .from('staff_availability' as any)
        .update(availabilityData)
        .eq('id', availability.id);

      if (error) throw error;

      toast({
        title: "Sukces",
        description: "Dostępność została zaktualizowana pomyślnie",
      });

      onClose();
      onEditComplete?.();
    } catch (error: any) {
      console.error('Error updating availability:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zaktualizować dostępności",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getDisplayName = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.name;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edytuj dostępność personelu</DialogTitle>
          <DialogDescription>
            Zaktualizuj informacje o dostępności pracownika
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="staff_id">Pracownik *</Label>
              <Select
                value={formData.staff_id}
                onValueChange={(value) => setFormData({ ...formData, staff_id: value })}
                disabled={loadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "Ładowanie..." : "Wybierz pracownika"} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {getDisplayName(user)} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div>
              <Label htmlFor="total_hours">Suma Godzin *</Label>
              <Input
                id="total_hours"
                type="number"
                step="0.1"
                min="0"
                value={formData.total_hours}
                onChange={(e) => setFormData({ ...formData, total_hours: e.target.value })}
                placeholder="np. 8.5"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Czas Rozpoczęcia</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="end_time">Czas Zakończenia</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="position">Stanowisko</Label>
              <Input
                id="position"
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="np. Recepcja I zm."
              />
            </div>

            <div>
              <Label htmlFor="location">Lokalizacja</Label>
              <Input
                id="location"
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="np. Recepcja"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSaving}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isSaving || loadingUsers}>
              {isSaving ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

