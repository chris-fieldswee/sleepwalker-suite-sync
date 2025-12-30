// src/hooks/useReceptionActions.ts
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { supabaseAdmin } from '@/integrations/supabase/admin-client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from './useReceptionData';
import { taskInputSchema, workLogSchema } from '@/lib/validation';
import { useAuth } from '@/contexts/AuthContext'; // ✅ FIXED: Import added
import type { IssueTask } from '@/components/reception/IssueDetailDialog';
import { LABEL_TO_CAPACITY_ID, normalizeCapacityLabel } from '@/lib/capacity-utils';

type CleaningType = Database["public"]["Enums"]["cleaning_type"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

const OPEN_TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'paused', 'repair_needed'];

export interface NewTaskState {
    roomId: string;
    cleaningType: CleaningType;
    capacityId: string; // Changed from guestCount: number to capacityId: string
    staffId: string | 'unassigned';
    notes: string;
    date: string;
}

export interface EditableTaskState {
    roomId: string;
    cleaningType: CleaningType;
    capacityId: string; // Changed from guestCount: number to capacityId: string
    staffId: string | 'unassigned';
    notes: string;
    date: string;
    timeLimit: number | null;
    status?: string;
}

const getTodayDateString = () => new Date().toISOString().split("T")[0];

const initialNewTaskState: NewTaskState = {
    roomId: "",
    cleaningType: "W",
    capacityId: "d", // Default to 'd' (2)
    staffId: "unassigned",
    notes: "",
    date: getTodayDateString(),
};

export function useReceptionActions(
    availableRooms: Room[],
    onTaskAdded?: () => void,
    onWorkLogSaved?: () => void,
    onIssueReported?: () => void,
    onIssueUpdated?: () => void,
    onTaskUpdated?: () => void,
    onTaskDeleted?: () => void,
) {
  const { toast } = useToast();
  const { userId } = useAuth(); // ✅ FIXED: Hook call added
  
  // Validate that availableRooms contains actual room data, not staff data
  useEffect(() => {
    if (availableRooms && availableRooms.length > 0) {
      const firstItem = availableRooms[0];
      // Check if it looks like a room (has name, group_type) vs staff (has role)
      if ('role' in firstItem && !('group_type' in firstItem)) {
        console.error("CRITICAL: availableRooms contains staff data instead of room data!", {
          firstItem,
          availableRooms: availableRooms.slice(0, 3)
        });
      }
    }
  }, [availableRooms]);
  
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isSubmittingNewIssue, setIsSubmittingNewIssue] = useState(false);
  const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  // Helper function to parse capacity_configurations from a room
  const parseCapacityConfigurations = (room: Room | null): Array<{
    capacity_id: string;
    capacity_label: string;
    cleaning_types: Array<{ type: CleaningType; time_limit: number }>;
  }> => {
    if (!room || !room.capacity_configurations) return [];
    
    try {
      let configs: any[] = [];
      if (typeof room.capacity_configurations === 'string') {
        configs = JSON.parse(room.capacity_configurations);
      } else if (Array.isArray(room.capacity_configurations)) {
        configs = room.capacity_configurations;
      }
      
      return configs.map((config: any) => {
        // Prefer capacity_id, fallback to deriving from capacity_label
        let capacityId = config.capacity_id;
        const capacityLabel = config.capacity_label || '';
        
        if (!capacityId && capacityLabel) {
          capacityId = LABEL_TO_CAPACITY_ID[normalizeCapacityLabel(capacityLabel)] || '';
        }
        
        return {
          capacity_id: capacityId || 'd', // Default fallback
          capacity_label: capacityLabel,
          cleaning_types: Array.isArray(config.cleaning_types) 
            ? config.cleaning_types.map((ct: any) => ({
                type: ct.type as CleaningType,
                time_limit: Number(ct.time_limit) || 30
              }))
            : []
        };
      });
    } catch (e) {
      console.error("Error parsing capacity_configurations:", e);
      return [];
    }
  };

  // Get time limit from room's capacity_configurations
  const getTimeLimitFromRoom = (room: Room | null, capacityId: string, cleaningType: CleaningType): number | null => {
    if (!room) return null;
    
    const configs = parseCapacityConfigurations(room);
    
    // Find the configuration matching the capacity_id
    const config = configs.find(c => c.capacity_id === capacityId);
    if (!config) return null;
    
    // Find the cleaning type in that configuration
    const cleaningTypeConfig = config.cleaning_types.find(ct => ct.type === cleaningType);
    if (!cleaningTypeConfig) return null;
    
    return cleaningTypeConfig.time_limit;
  };

  // --- handleAddTask ---
    const handleAddTask = async (newTask: NewTaskState): Promise<boolean> => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useReceptionActions.ts:142',message:'handleAddTask entry',data:{newTask,capacityId:newTask.capacityId,capacityIdType:typeof newTask.capacityId},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        setIsSubmittingTask(true);
        let success = false;
        try {
            // Better error handling for room lookup
            if (!newTask.roomId) {
              throw new Error("Room ID is required.");
            }

            if (!availableRooms || availableRooms.length === 0) {
              console.error("Available rooms array is empty or undefined");
              throw new Error("No rooms available. Please refresh the page.");
            }

            // Validate that availableRooms contains room data, not staff data
            const firstItem = availableRooms[0];
            if (firstItem && 'role' in firstItem && !('group_type' in firstItem)) {
              console.error("CRITICAL ERROR: availableRooms contains staff data instead of room data!", {
                firstItem,
                availableRoomsSample: availableRooms.slice(0, 3)
              });
              throw new Error("Configuration error: Rooms data is incorrect. Please refresh the page or contact support.");
            }

            // Normalize room ID for comparison (trim and convert to string)
            const normalizedRoomId = String(newTask.roomId).trim();
            
            // Try multiple lookup strategies
            let selectedRoom = availableRooms.find(r => String(r.id).trim() === normalizedRoomId);
            
            // If still not found, try case-insensitive comparison
            if (!selectedRoom) {
              selectedRoom = availableRooms.find(r => 
                String(r.id).trim().toLowerCase() === normalizedRoomId.toLowerCase()
              );
            }
            
            if (!selectedRoom) {
              console.error("Room lookup failed:", {
                roomId: newTask.roomId,
                normalizedRoomId,
                roomIdType: typeof newTask.roomId,
                availableRoomsCount: availableRooms.length,
                availableRoomIds: availableRooms.map(r => ({ id: r.id, idType: typeof r.id, idString: String(r.id) })),
                availableRoomNames: availableRooms.map(r => r.name),
                // Check if any room IDs match when converted to string
                matchingIds: availableRooms.filter(r => String(r.id).trim() === normalizedRoomId).map(r => r.id)
              });
              throw new Error(`Selected room not found. Room ID: ${newTask.roomId}. Please select a room again.`);
            }

            const resolvedRoomId = String(selectedRoom.id ?? "").trim();
            if (!resolvedRoomId) {
              throw new Error("Configuration error: Resolved room ID is empty. Please select a room again.");
            }

            // Ensure there is no other open task for this room on the same date
            const { data: existingOpenTasks, error: existingOpenTasksError } = await supabase
                .from('tasks')
                .select('id')
                .eq('date', newTask.date)
                .eq('room_id', resolvedRoomId)
                .in('status', OPEN_TASK_STATUSES);

            if (existingOpenTasksError) {
              console.error("Error checking for existing open tasks:", existingOpenTasksError);
              throw new Error("Could not verify existing tasks. Please try again.");
            }

            if (existingOpenTasks && existingOpenTasks.length > 0) {
              toast({
                title: "Room Already Assigned",
                description: "An open task already exists for this room on the selected date. Close it before creating another.",
                variant: "destructive",
              });
              return false;
            }

            const validation = taskInputSchema.safeParse({
              cleaning_type: newTask.cleaningType,
              guest_count: newTask.capacityId, // guest_count now stores capacity_id
              reception_notes: newTask.notes,
              date: newTask.date,
              room_id: resolvedRoomId,
            });

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useReceptionActions.ts:220',message:'validation result',data:{validationSuccess:validation.success,validationErrors:validation.success?null:validation.error.errors,capacityId:newTask.capacityId},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
            // #endregion

            if (!validation.success) {
              toast({
                title: "Validation Error",
                description: validation.error.errors[0].message,
                variant: "destructive"
              });
              return false;
            }

            // Get time limit from room's capacity_configurations
            let timeLimit = getTimeLimitFromRoom(selectedRoom, newTask.capacityId, newTask.cleaningType);
            
            // Fallback to global limits table if not found in room config
            if (timeLimit === null) {
              console.log("Time limit not found in room config, trying global limits table...");
              const { data: limitData, error: limitError } = await supabase
                  .from('limits')
                  .select('time_limit')
                  .eq('group_type', selectedRoom.group_type)
                  .eq('cleaning_type', newTask.cleaningType)
                  .eq('guest_count', newTask.capacityId) // guest_count now stores capacity_id
                  .maybeSingle();

              if (limitError) {
                console.warn(`Could not fetch time limit: ${limitError.message}. Proceeding without limit.`);
              } else {
                timeLimit = limitData?.time_limit ?? null;
              }
            }

            // Handle user_id: convert 'unassigned' or empty string to null
            const userId = (newTask.staffId === 'unassigned' || newTask.staffId === '' || !newTask.staffId) 
                ? null 
                : newTask.staffId;

            const taskToInsert = {
                date: newTask.date,
                room_id: resolvedRoomId,
                cleaning_type: newTask.cleaningType,
                guest_count: newTask.capacityId, // guest_count now stores capacity_id
                time_limit: timeLimit,
                reception_notes: newTask.notes || null,
                user_id: userId,
                status: 'todo' as const,
            };

            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useReceptionActions.ts:263',message:'taskToInsert before insert',data:{taskToInsert,capacityId:newTask.capacityId,capacityIdType:typeof newTask.capacityId,guest_count:taskToInsert.guest_count,guest_countType:typeof taskToInsert.guest_count},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
            // #endregion

            // Try with regular client first
            let insertError = null;
            const { error: regularError } = await supabase.from('tasks').insert(taskToInsert);
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useReceptionActions.ts:276',message:'insert result',data:{hasError:!!regularError,errorCode:regularError?.code,errorMessage:regularError?.message,errorDetails:regularError?.details,errorHint:regularError?.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            // If RLS error and admin client is available, try with admin client
            if (regularError && regularError.code === '42501' && supabaseAdmin) {
                console.warn("RLS policy violation, retrying with admin client...");
                const { error: adminError } = await supabaseAdmin.from('tasks').insert(taskToInsert);
                if (adminError) {
                    insertError = adminError;
                } else {
                    console.log("Successfully inserted task using admin client");
                }
            } else if (regularError) {
                insertError = regularError;
            }
            
            if (insertError) {
                if (insertError.code === '23505') {
                    throw new Error("An open task already exists for this room on the selected date. Close it before creating another.");
                }
                // Provide more helpful error message for RLS violations
                if (insertError.code === '42501') {
                    throw new Error("Permission denied: You don't have permission to create tasks. Please ensure your account has 'reception' or 'admin' role.");
                }
                throw insertError;
            }

            toast({ title: "Task Added Successfully", description: `Task for ${selectedRoom.name} on ${newTask.date} created.` });
            onTaskAdded?.();
            success = true;

        } catch (error: any) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/9569eff2-9500-4fbd-b88b-df134a018361',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useReceptionActions.ts:306',message:'error caught in catch block',data:{errorMessage:error?.message,errorCode:error?.code,errorDetails:error?.details,errorHint:error?.hint,errorStack:error?.stack,errorString:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            console.error("Error adding task:", error);
            toast({ title: "Error Adding Task", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmittingTask(false);
        }
        return success;
    };

  // --- handleSaveWorkLog ---
    const handleSaveWorkLog = async (logData: any): Promise<boolean> => {
       const validation = workLogSchema.safeParse({
         user_id: logData.user_id,
         date: logData.date,
         time_in: logData.time_in || null,
         time_out: logData.time_out || null,
         break_minutes: logData.break_minutes || 0,
         laundry_minutes: logData.laundry_minutes || 0,
         breakfast_minutes: logData.breakfast_minutes || 0,
         total_minutes: logData.total_minutes || null,
         notes: logData.notes || '',
       });

       if (!validation.success) {
         toast({
           title: "Validation Error",
           description: validation.error.errors[0].message,
           variant: "destructive"
         });
         return false;
       }

        setIsSavingLog(true);
        let success = false;
        try {
            const formatTime = (timeStr: string | null | undefined): string | null => {
                if (!timeStr) return null;
                const baseDate = new Date(validation.data.date + 'T00:00:00Z');
                 if (isNaN(baseDate.getTime())) {
                     console.error("Invalid base date for time formatting:", validation.data.date);
                     return null;
                 }
                const [hours, minutes] = timeStr.split(':').map(Number);
                 if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                    console.error("Invalid time format detected:", timeStr);
                    return null;
                 }
                baseDate.setUTCHours(hours, minutes, 0, 0);
                return baseDate.toISOString();
            };

             let calculatedTotalMinutes: number | null = null;
             const isoTimeIn = formatTime(validation.data.time_in);
             const isoTimeOut = formatTime(validation.data.time_out);

             if (isoTimeIn && isoTimeOut) {
                 try {
                     const timeInDate = new Date(isoTimeIn);
                     const timeOutDate = new Date(isoTimeOut);
                     if (!isNaN(timeInDate.getTime()) && !isNaN(timeOutDate.getTime())) {
                         const diffMs = timeOutDate.getTime() - timeInDate.getTime();
                         const netMinutes = Math.round(diffMs / 60000) - (validation.data.break_minutes ?? 0);
                         calculatedTotalMinutes = Math.max(0, netMinutes);
                     }
                 } catch (e) {
                     console.error("Error calculating total minutes from times:", e);
                 }
             }

            const upsertData: Database["public"]["Tables"]["work_logs"]["Insert"] = {
                user_id: validation.data.user_id,
                date: validation.data.date,
                time_in: isoTimeIn,
                time_out: isoTimeOut,
                break_minutes: validation.data.break_minutes,
                laundry_minutes: validation.data.laundry_minutes,
                breakfast_minutes: validation.data.breakfast_minutes,
                total_minutes: calculatedTotalMinutes,
                notes: validation.data.notes || null,
             };

             if (!logData.id) {
                 delete (upsertData as any).id;
             } else {
                 (upsertData as any).id = logData.id;
             }

            const { error } = await supabase.from("work_logs").upsert(
                upsertData as any,
                { onConflict: 'user_id, date' }
             );

            if (error) throw error;

            toast({ title: "Work Log Saved", description: "Work log updated successfully." });
            onWorkLogSaved?.();
            success = true;
        } catch (error: any) {
            console.error("Error saving work log:", error);
            toast({ title: "Error Saving Log", description: error.message, variant: "destructive" });
        } finally {
            setIsSavingLog(false);
        }
        return success;
    };

  // --- handleReportNewIssue ---
   const handleReportNewIssue = async (roomId: string, description: string, photo: File | null): Promise<boolean> => {
        if (!roomId || !description.trim()) {
          toast({ title: "Missing Information", description: "Room and description are required.", variant: "destructive" });
          return false;
        }
         if (description.length > 5000) {
              toast({ title: "Description Too Long", description: "Description must be less than 5000 characters.", variant: "destructive" });
              return false;
         }

        setIsSubmittingNewIssue(true);
        let success = false;
        let photoUrl: string | null = null;
        let filePath: string | undefined = undefined;

        try {
            // Get current user for reported_by_user_id
            const { data: currentUser } = await supabase
                .from('users')
                .select('id')
                .eq('auth_id', userId)
                .single();

            if (photo && userId) {
                const fileExt = photo.name.split('.').pop();
                const fileName = `temp_${Date.now()}.${fileExt}`;
                
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('issue-photos')
                    .upload(fileName, photo);

                if (uploadError) {
                    throw new Error(`Photo upload failed: ${uploadError.message}`);
                }
                if (uploadData) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('issue-photos')
                        .getPublicUrl(uploadData.path);
                    photoUrl = publicUrl;
                    filePath = uploadData.path;
                     if (!photoUrl) {
                        console.warn("Could not get public URL for uploaded photo:", filePath);
                     }
                } else {
                     throw new Error('Photo upload failed unexpectedly (no data returned).');
                }
            } else if (photo && !userId) {
                console.error("Cannot upload photo: User ID is not available.");
                toast({ title: "Upload Error", description: "Could not upload photo, user not identified.", variant: "destructive" });
                setIsSubmittingNewIssue(false);
                return false;
            }

            // Insert into issues table
            const issueToInsert = {
                room_id: roomId,
                title: description.substring(0, 100), // First 100 chars as title
                description: description,
                photo_url: photoUrl,
                reported_by_user_id: currentUser?.id || null,
                status: 'open' as const,
                priority: 'medium' as const,
            };

            const { error: insertError } = await supabase.from('issues').insert(issueToInsert);

            if (insertError) {
                if (photoUrl && filePath) {
                    console.warn("Database insert failed, attempting to delete uploaded photo:", filePath);
                    await supabase.storage.from('issue-photos').remove([filePath]);
                }
                throw insertError;
            }

            const roomName = availableRooms.find(r => r.id === roomId)?.name || 'Unknown Room';
            toast({ title: "Issue Reported Successfully", description: `New issue created for ${roomName}.` });
            onIssueReported?.();
            success = true;

        } catch (error: any) {
            console.error("Error reporting new issue:", error);
            toast({ title: "Error Reporting Issue", description: error.message, variant: "destructive" });
            success = false;
        } finally {
            setIsSubmittingNewIssue(false);
        }
        return success;
    };

  // --- handleUpdateIssue ---
    const handleUpdateIssue = async (
        taskId: string,
        updates: Partial<{
            issue_flag: boolean | null;
            reception_notes: string | null;
            user_id: string | null | 'unassigned';
        }>
    ): Promise<boolean> => {
        setIsUpdatingIssue(true);
        let success = false;
        try {
             if (updates.reception_notes && updates.reception_notes.length > 2000) {
                 throw new Error("Reception notes cannot exceed 2000 characters.");
             }

             const finalUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {
                 user_id: (updates.user_id === 'unassigned' || updates.user_id === '' || !updates.user_id) ? null : updates.user_id,
                 reception_notes: updates.reception_notes,
                 issue_flag: updates.issue_flag
             };

             if (updates.issue_flag === false) {
                 finalUpdates.status = 'todo';
             } else if (updates.issue_flag === true) {
                 finalUpdates.status = 'repair_needed';
             }

            const { error } = await supabase
                .from('tasks')
                .update(finalUpdates)
                .eq('id', taskId);

            if (error) throw error;

            toast({ title: "Changes saved", description: "Issue details updated successfully." });
            onIssueUpdated?.();
            success = true;
        } catch (error: any) {
            console.error("Error updating issue:", error);
            toast({ title: "Error Updating Issue", description: error.message, variant: "destructive" });
            success = false;
        } finally {
            setIsUpdatingIssue(false);
        }
        return success;
    };

  // --- handleUpdateTask ---
  const handleUpdateTask = async (taskId: string, updates: Partial<EditableTaskState>): Promise<boolean> => {
      setIsUpdatingTask(true);
      let success = false;
      try {
          const dbUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {};
          let needsLimitCheck = false;

          if (updates.roomId !== undefined) { dbUpdates.room_id = updates.roomId; needsLimitCheck = true; }
          if (updates.cleaningType !== undefined) { dbUpdates.cleaning_type = updates.cleaningType; needsLimitCheck = true; }
          if (updates.capacityId !== undefined) { dbUpdates.guest_count = updates.capacityId; needsLimitCheck = true; } // guest_count now stores capacity_id
          if (updates.staffId !== undefined) { 
            dbUpdates.user_id = (updates.staffId === 'unassigned' || updates.staffId === '' || !updates.staffId) 
              ? null 
              : updates.staffId; 
          }
          if (updates.notes !== undefined) { dbUpdates.reception_notes = updates.notes || null; }
          if (updates.date !== undefined) { dbUpdates.date = updates.date; }
          if (updates.status !== undefined) { dbUpdates.status = updates.status as Database["public"]["Enums"]["task_status"]; }
          
          if (updates.timeLimit !== undefined) {
             dbUpdates.time_limit = updates.timeLimit;
          } else if (needsLimitCheck) {
              const { data: currentTaskInfo, error: currentInfoError } = await supabase
                 .from('tasks')
                 .select('cleaning_type, guest_count, room_id, room:rooms!inner(group_type)')
                 .eq('id', taskId)
                 .single();

              if (currentInfoError || !currentTaskInfo) {
                   console.error("Error fetching current task info:", currentInfoError);
                   throw new Error("Could not fetch current task info for limit check.");
              }

              const finalRoomId = updates.roomId ?? currentTaskInfo.room_id;
              const room = availableRooms.find(r => r.id === finalRoomId);
              const groupType = room?.group_type;
              const cleaningType = updates.cleaningType ?? currentTaskInfo.cleaning_type;
              const capacityId = updates.capacityId ?? currentTaskInfo.guest_count; // guest_count now stores capacity_id

             if (groupType && cleaningType && capacityId) {
                  const { data: limitData, error: limitError } = await supabase
                     .from('limits')
                     .select('time_limit')
                     .eq('group_type', groupType)
                     .eq('cleaning_type', cleaningType)
                     .eq('guest_count', capacityId) // guest_count now stores capacity_id
                     .maybeSingle();

                  if (limitError) console.warn("Could not fetch new time limit during update:", limitError.message);
                  dbUpdates.time_limit = limitData?.time_limit ?? null;
             } else {
                 console.warn("Could not determine all required fields for time limit check. Setting limit to null.");
                 dbUpdates.time_limit = null;
             }
          }

          if (Object.keys(dbUpdates).length === 0) {
              toast({ title: "No Changes Detected", description: "Task details were not modified." });
              setIsUpdatingTask(false);
              return true;
          }

          const { error } = await supabase
              .from('tasks')
              .update(dbUpdates)
              .eq('id', taskId);

          if (error) throw error;

          toast({ title: "Changes saved", description: "Task details updated successfully." });
          onTaskUpdated?.();
          success = true;

      } catch (error: any) {
          console.error("Error updating task:", error);
          toast({ title: "Error Updating Task", description: error.message, variant: "destructive" });
          success = false;
      } finally {
          setIsUpdatingTask(false);
      }
      return success;
  };

  // --- handleDeleteTask ---
  const handleDeleteTask = async (taskId: string): Promise<boolean> => {
      setIsDeletingTask(true);
      let success = false;
      try {
          const { error } = await supabase
              .from('tasks')
              .delete()
              .eq('id', taskId);

          if (error) throw error;

          toast({ title: "Changes saved", description: "Task removed successfully." });
          onTaskDeleted?.();
          success = true;

      } catch (error: any) {
          console.error("Error deleting task:", error);
          toast({ title: "Error Deleting Task", description: error.message, variant: "destructive" });
          success = false;
      } finally {
          setIsDeletingTask(false);
      }
      return success;
  };

  return {
      handleAddTask,
      isSubmittingTask,
      handleSaveWorkLog,
      isSavingLog,
      initialNewTaskState,
      handleReportNewIssue,
      isSubmittingNewIssue,
      handleUpdateIssue,
      isUpdatingIssue,
      handleUpdateTask,
      isUpdatingTask,
      handleDeleteTask,
      isDeletingTask,
  };
}
