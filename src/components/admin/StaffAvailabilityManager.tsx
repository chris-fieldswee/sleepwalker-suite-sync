import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { ImportAvailabilityDialog } from './ImportAvailabilityDialog';

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
      let query = supabase
        .from('staff_availability' as any)
        .select(`
          *,
          staff:users(id, name, first_name, last_name, role)
        `);

      if (dateFilter) {
        query = query.eq('date', dateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Sort by date: oldest first, then future dates at bottom
      const sortedData = ((data || []) as unknown as StaffAvailability[]).sort((a, b) => {
        const today = new Date().toISOString().split('T')[0];
        const dateA = a.date;
        const dateB = b.date;
        
        // If both are past or both are future, sort chronologically
        if ((dateA <= today && dateB <= today) || (dateA > today && dateB > today)) {
          return dateA.localeCompare(dateB);
        }
        // Past dates come first
        if (dateA <= today && dateB > today) return -1;
        if (dateA > today && dateB <= today) return 1;
        return 0;
      });
      
      setAvailability(sortedData);
    } catch (error: any) {
      console.error('Error fetching availability:', error);
      toast({
        title: "Error",
        description: "Failed to fetch staff availability",
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

  const getAvailabilityBadge = (availableHours: number) => {
    if (availableHours <= 0) {
      return <Badge variant="destructive">Unavailable</Badge>;
    } else if (availableHours < 2) {
      return <Badge variant="secondary">Limited</Badge>;
    } else if (availableHours < 4) {
      return <Badge variant="outline">Available</Badge>;
    } else {
      return <Badge variant="default">Fully Available</Badge>;
    }
  };

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
          <h2 className="text-2xl font-bold">Staff Availability</h2>
          <p className="text-muted-foreground">Manage and view staff availability schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <ImportAvailabilityDialog onImportComplete={handleRefresh} />
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="staff">Staff</Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="All staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {availableStaff.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="reception">Reception</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Table */}
      <Card>
        <CardHeader>
          <CardTitle>Availability Schedule</CardTitle>
          <CardDescription>
            Showing {filteredAvailability.length} availability records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Assigned Hours</TableHead>
                      <TableHead>Available Hours</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAvailability.slice(0, 10).map((item) => (
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
                        <TableCell>{getAvailabilityBadge(item.available_hours)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {filteredAvailability.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No availability records found
                </div>
              )}
              
              {filteredAvailability.length > 10 && (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  Showing 10 of {filteredAvailability.length} records. Use filters to narrow down results.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
