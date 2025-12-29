import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ImportAvailabilityDialog } from './ImportAvailabilityDialog';
import { AddAvailabilityDialog } from './AddAvailabilityDialog';

type StaffAvailability = {
  id: string;
  staff_id: string;
  date: string;
  total_hours: number;
  assigned_hours: number;
  available_hours: number;
  position: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  updated_at: string;
  staff: {
    id: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    role: string;
  } | null;
};

export const StaffAvailabilityManager: React.FC = () => {
  const [availability, setAvailability] = useState<StaffAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('staff_availability' as any)
        .select(`
          *,
          staff:users(id, name, first_name, last_name, role)
        `)
        .gte('date', today); // Only fetch current and future dates

      if (dateFilter) {
        query = query.eq('date', dateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Sort by date chronologically (ascending)
      const sortedData = ((data || []) as unknown as StaffAvailability[]).sort((a, b) => {
        return a.date.localeCompare(b.date);
      });

      setAvailability(sortedData);
    } catch (error: any) {
      console.error('Error fetching availability:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać dostępności personelu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [dateFilter]);

  // Reset staff selection when role filter changes
  useEffect(() => {
    setSelectedStaffId('all');
  }, [roleFilter]);

  // Get unique staff members filtered by role
  const availableStaff = useMemo(() => {
    const staffMap = new Map<string, { id: string; name: string }>();

    availability.forEach(item => {
      const matchesRole = roleFilter === 'all' || item.staff.role === roleFilter;
      if (matchesRole && !staffMap.has(item.staff.id)) {
        const displayName = item.staff.first_name && item.staff.last_name
          ? `${item.staff.first_name} ${item.staff.last_name}`
          : item.staff.name;
        staffMap.set(item.staff.id, {
          id: item.staff.id,
          name: displayName
        });
      }
    });

    return Array.from(staffMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availability, roleFilter]);

  const filteredAvailability = useMemo(() => {
    return availability.filter(item => {
      const matchesStaff = selectedStaffId === 'all' || item.staff.id === selectedStaffId;
      const matchesRole = roleFilter === 'all' || item.staff.role === roleFilter;

      return matchesStaff && matchesRole;
    });
  }, [availability, selectedStaffId, roleFilter]);


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL');
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    return timeString;
  };

  const handleRefresh = () => {
    fetchAvailability();
  };

  return (
    <div className="space-y-6">
      {/* Header with buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Dostępność personelu</h2>
          <p className="text-muted-foreground">Zarządzaj i przeglądaj harmonogramy dostępności personelu</p>
        </div>
        <div className="flex items-center gap-2">
          <AddAvailabilityDialog onAddComplete={handleRefresh} />
          <ImportAvailabilityDialog onImportComplete={handleRefresh} />
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Odśwież
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="staff">Personel</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Cały personel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cały Personel</SelectItem>
                  {availableStaff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="role">Rola</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie Role</SelectItem>
                  <SelectItem value="housekeeping">Sprzątanie</SelectItem>
                  <SelectItem value="reception">Recepcja</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedStaffId('all');
                  setDateFilter('');
                  setRoleFilter('all');
                }}
                className="w-full"
              >
                Wyczyść Filtry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Table */}
      <Card>
        <CardHeader>
          <CardTitle>Harmonogram dostępności</CardTitle>
          <CardDescription>
            Wyświetlanie {filteredAvailability.length} rekordów dostępności
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="h-[calc(48px+40px*10)] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Pracownik</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Stanowisko</TableHead>
                      <TableHead>Lokalizacja</TableHead>
                      <TableHead>Czas Rozpoczęcia</TableHead>
                      <TableHead>Czas Zakończenia</TableHead>
                      <TableHead>Suma Godzin</TableHead>
                      <TableHead>Przydzielone Godziny</TableHead>
                      <TableHead>Dostępne Godziny</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAvailability.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.staff.first_name && item.staff.last_name
                            ? `${item.staff.first_name} ${item.staff.last_name}`
                            : item.staff.name
                          }
                        </TableCell>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell>{item.position || '-'}</TableCell>
                        <TableCell>{item.location || '-'}</TableCell>
                        <TableCell>{formatTime(item.start_time)}</TableCell>
                        <TableCell>{formatTime(item.end_time)}</TableCell>
                        <TableCell>{item.total_hours}h</TableCell>
                        <TableCell>{item.assigned_hours}h</TableCell>
                        <TableCell className="font-medium">{item.available_hours}h</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filteredAvailability.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nie znaleziono rekordów dostępności
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
