import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";

export type DateRange = {
  from: Date;
  to: Date;
};

type TaskStatus = Database["public"]["Enums"]["task_status"];
type CleaningType = Database["public"]["Enums"]["cleaning_type"];
type IssueStatus = Database["public"]["Enums"]["issue_status"];
type IssuePriority = Database["public"]["Enums"]["issue_priority"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

export interface TaskReportData {
  id: string;
  date: string;
  status: TaskStatus;
  cleaning_type: CleaningType;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  room_id: string;
  room_name: string;
  room_group: RoomGroup;
  user_id: string | null;
  user_name: string | null;
  created_at: string | null;
}

export interface IssueReportData {
  id: string;
  room_id: string;
  room_name: string;
  room_group: RoomGroup;
  status: IssueStatus;
  priority: IssuePriority;
  reported_at: string;
  resolved_at: string | null;
  reported_by_user_id: string | null;
  resolved_by_user_id: string | null;
}

export interface WorkLogReportData {
  id: string;
  user_id: string;
  user_name: string;
  date: string;
  total_minutes: number | null;
  break_minutes: number | null;
  breakfast_minutes: number | null;
  laundry_minutes: number | null;
}

export interface RoomReportData {
  id: string;
  name: string;
  group_type: RoomGroup;
}

export interface ReportsData {
  tasks: TaskReportData[];
  issues: IssueReportData[];
  workLogs: WorkLogReportData[];
  rooms: RoomReportData[];
  loading: boolean;
  error: string | null;
}

export function useAdminReports(dateRange: DateRange) {
  const { toast } = useToast();
  const [data, setData] = useState<ReportsData>({
    tasks: [],
    issues: [],
    workLogs: [],
    rooms: [],
    loading: true,
    error: null,
  });

  const formatDateForQuery = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const fetchData = useCallback(async () => {
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));

      const fromDate = formatDateForQuery(dateRange.from);
      const toDate = formatDateForQuery(dateRange.to);

      // Fetch tasks with related data
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          date,
          status,
          cleaning_type,
          time_limit,
          actual_time,
          difference,
          room_id,
          created_at,
          room:rooms!inner(id, name, group_type),
          user:users(id, name, first_name, last_name)
        `)
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch issues with related data
      // Set "to" date to end of day (23:59:59.999) to include the entire day
      const toDateEndOfDay = new Date(dateRange.to);
      toDateEndOfDay.setHours(23, 59, 59, 999);
      
      const { data: issuesData, error: issuesError } = await supabase
        .from('issues')
        .select(`
          id,
          room_id,
          status,
          priority,
          reported_at,
          resolved_at,
          reported_by_user_id,
          resolved_by_user_id,
          room:rooms!inner(id, name, group_type)
        `)
        .gte('reported_at', dateRange.from.toISOString())
        .lte('reported_at', toDateEndOfDay.toISOString())
        .order('reported_at', { ascending: false });

      if (issuesError) throw issuesError;

      // Fetch work logs with related data
      const { data: workLogsData, error: workLogsError } = await supabase
        .from('work_logs')
        .select(`
          id,
          user_id,
          date,
          total_minutes,
          break_minutes,
          breakfast_minutes,
          laundry_minutes,
          user:users!inner(id, name, first_name, last_name)
        `)
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: false });

      if (workLogsError) throw workLogsError;

      // Fetch rooms
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name, group_type')
        .eq('active', true)
        .order('name');

      if (roomsError) throw roomsError;

      // Transform tasks data
      const transformedTasks: TaskReportData[] = (tasksData || []).map(task => ({
        id: task.id,
        date: task.date,
        status: task.status as TaskStatus,
        cleaning_type: task.cleaning_type as CleaningType,
        time_limit: task.time_limit,
        actual_time: task.actual_time,
        difference: task.difference,
        room_id: (task.room as any)?.id || '',
        room_name: (task.room as any)?.name || '',
        room_group: (task.room as any)?.group_type as RoomGroup,
        user_id: (task.user as any)?.id || null,
        user_name: (task.user as any)?.first_name && (task.user as any)?.last_name
          ? `${(task.user as any).first_name} ${(task.user as any).last_name}`
          : (task.user as any)?.name || null,
        created_at: task.created_at,
      }));

      // Transform issues data
      const transformedIssues: IssueReportData[] = (issuesData || []).map(issue => ({
        id: issue.id,
        room_id: (issue.room as any)?.id || '',
        room_name: (issue.room as any)?.name || '',
        room_group: (issue.room as any)?.group_type as RoomGroup,
        status: issue.status as IssueStatus,
        priority: issue.priority as IssuePriority,
        reported_at: issue.reported_at,
        resolved_at: issue.resolved_at,
        reported_by_user_id: issue.reported_by_user_id,
        resolved_by_user_id: issue.resolved_by_user_id,
      }));

      // Transform work logs data
      const transformedWorkLogs: WorkLogReportData[] = (workLogsData || []).map(log => ({
        id: log.id,
        user_id: log.user_id,
        user_name: (log.user as any)?.first_name && (log.user as any)?.last_name
          ? `${(log.user as any).first_name} ${(log.user as any).last_name}`
          : (log.user as any)?.name || '',
        date: log.date,
        total_minutes: log.total_minutes,
        break_minutes: log.break_minutes,
        breakfast_minutes: log.breakfast_minutes,
        laundry_minutes: log.laundry_minutes,
      }));

      // Transform rooms data
      const transformedRooms: RoomReportData[] = (roomsData || []).map(room => ({
        id: room.id,
        name: room.name,
        group_type: room.group_type as RoomGroup,
      }));

      setData({
        tasks: transformedTasks,
        issues: transformedIssues,
        workLogs: transformedWorkLogs,
        rooms: transformedRooms,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error fetching reports data:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch reports data',
      }));
      toast({
        title: 'Błąd',
        description: 'Nie udało się pobrać danych raportów.',
        variant: 'destructive',
      });
    }
  }, [dateRange, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...data, refetch: fetchData };
}

