import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar, Search, RefreshCw, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type StaffAvailability = Database["public"]["Tables"]["staff_availability"]["Row"] & {
  staff: Database["public"]["Tables"]["users"]["Row"];
};

export const StaffAvailabilityManager: React.FC = () => {
  const [availability, setAvailability] = useState<StaffAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const query = supabase
        .from('staff_availability')
        .select(`
          *,
          staff:users(*)
        `)
        .order('date', { ascending: false });

      if (dateFilter) {
        query.eq('date', dateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAvailability(data || []);
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

  const filteredAvailability = availability.filter(item => {
    const matchesSearch = 
      item.staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.staff.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.staff.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || item.staff.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Staff Availability</h2>
          <p className="text-muted-foreground">Manage and view staff availability schedules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAvailability}>
            <RefreshCw className="h-4 w-4 mr-2" />
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
              <Label htmlFor="search">Search Staff</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
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
                  setSearchTerm('');
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
              <Table>
                <TableHeader>
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
                      <TableCell>{getAvailabilityBadge(item.available_hours)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {filteredAvailability.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No availability records found
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
