import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddAvailabilityDialogProps {
  onAddComplete?: () => void;
}

type User = {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
};

export const AddAvailabilityDialog: React.FC<AddAvailabilityDialogProps> = ({ onAddComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
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
        description: "Nie można dodać dostępności dla dat z przeszłości. Tylko dzisiejsza i przyszłe daty są dozwolone.",
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

    setIsAdding(true);
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
        .upsert(availabilityData, {
          onConflict: 'staff_id,date',
          ignoreDuplicates: false
        });

      if (error) throw error;

      toast({
        title: "Sukces",
        description: "Dostępność została dodana pomyślnie",
      });

      // Reset form
      setFormData({
        staff_id: '',
        date: '',
        total_hours: '',
        position: '',
        location: '',
        start_time: '',
        end_time: '',
      });

      setIsOpen(false);
      onAddComplete?.();
    } catch (error: any) {
      console.error('Error adding availability:', error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się dodać dostępności",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const getDisplayName = (user: User) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.name;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Dodaj Dostępność
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dodaj dostępność personelu</DialogTitle>
          <DialogDescription>
            Ręcznie dodaj dostępność dla wybranego pracownika
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
            <Button variant="outline" type="button" onClick={() => setIsOpen(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={isAdding || loadingUsers}>
              {isAdding ? "Dodawanie..." : "Dodaj"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

