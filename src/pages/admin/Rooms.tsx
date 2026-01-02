import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, DoorOpen, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/admin-client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { RoomConfigurationDialog } from "@/components/admin/RoomConfigurationDialog";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomGroup = Database["public"]["Enums"]["room_group"];
type CleaningType = Database["public"]["Enums"]["cleaning_type"];

// Sort cleaning types with 'G' (Generalne) always last
const sortCleaningTypes = (types: CleaningType[]): CleaningType[] => {
  return types.sort((a, b) => {
    // Put 'G' at the end
    if (a === 'G') return 1;
    if (b === 'G') return -1;
    // Sort others alphabetically
    return a.localeCompare(b);
  });
};

export default function Rooms() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState<RoomGroup | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [typeSortDirection, setTypeSortDirection] = useState<"asc" | "desc" | null>(null);
  const [createdSortDirection, setCreatedSortDirection] = useState<"asc" | "desc" | null>(null);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setRooms(data || []);
    } catch (error: any) {
      console.error("Error fetching rooms:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać pokoi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const filteredRooms = rooms.filter(room => {
    const matchesGroup = groupFilter === "all" || room.group_type === groupFilter;
    return matchesGroup;
  });

  const roomTypeOrder: Record<RoomGroup, number> = {
    P1: 0,
    P2: 1,
    A1S: 2,
    A2S: 3,
    OTHER: 4,
  };

  const displayedRooms = (() => {
    let sorted = [...filteredRooms];
    
    // Apply type sorting if active
    if (typeSortDirection) {
      sorted = sorted.sort((a, b) => {
        const aOrder = roomTypeOrder[a.group_type] ?? 999;
        const bOrder = roomTypeOrder[b.group_type] ?? 999;
        return typeSortDirection === "asc" ? aOrder - bOrder : bOrder - aOrder;
      });
    }
    
    // Apply created date sorting if active (takes priority over type sort)
    if (createdSortDirection) {
      sorted = sorted.sort((a, b) => {
        const aDate = new Date(a.created_at || 0).getTime();
        const bDate = new Date(b.created_at || 0).getTime();
        return createdSortDirection === "asc" ? aDate - bDate : bDate - aDate;
      });
    }
    
    return sorted;
  })();

  const toggleTypeSort = () => {
    setTypeSortDirection(prev => {
      const next = prev === "asc" ? "desc" : prev === "desc" ? null : "asc";
      // Clear created sort when type sort is activated
      if (next !== null) {
        setCreatedSortDirection(null);
      }
      return next;
    });
  };

  const toggleCreatedSort = () => {
    setCreatedSortDirection(prev => {
      const next = prev === "asc" ? "desc" : prev === "desc" ? null : "asc";
      // Clear type sort when created sort is activated
      if (next !== null) {
        setTypeSortDirection(null);
      }
      return next;
    });
  };

  const handleSaveRoom = async (roomData: {
    name: string;
    group_type: RoomGroup;
    capacity_configurations: Array<{
      capacity: number;
      capacity_label: string;
      cleaning_types: Array<{
        type: string;
        time_limit: number;
      }>;
    }>;
  }) => {
    setIsSaving(true);
    try {
      // Prefer admin client to bypass RLS, but fallback to regular client
      const client = supabaseAdmin || supabase;
      
      // Log which client we're using for debugging
      if (supabaseAdmin) {
        console.log("Using admin client (bypasses RLS)");
      } else {
        console.warn("Admin client not available, using regular client (subject to RLS)");
      }
      
      // Prepare the data object
      const roomDataToSave: any = {
        name: roomData.name,
        group_type: roomData.group_type,
        capacity_configurations: roomData.capacity_configurations || [],
      };

      // Extract unique cleaning types from capacity_configurations
      const cleaningTypesSet = new Set<string>();
      roomData.capacity_configurations.forEach(config => {
        if (config.cleaning_types && Array.isArray(config.cleaning_types)) {
          config.cleaning_types.forEach((ct: { type: string; time_limit: number }) => {
            if (ct.type) {
              cleaningTypesSet.add(ct.type);
            }
          });
        }
      });
      roomDataToSave.cleaning_types = sortCleaningTypes(Array.from(cleaningTypesSet) as CleaningType[]);

      // For non-OTHER rooms, set legacy fields for backward compatibility
      if (roomData.group_type !== 'OTHER' && roomData.capacity_configurations.length > 0) {
        const firstConfig = roomData.capacity_configurations[0];
        // Use capacity_id to derive numeric capacity if not present
        if (firstConfig.capacity !== undefined) {
          roomDataToSave.capacity = firstConfig.capacity;
        } else if (firstConfig.capacity_id) {
          // Derive numeric capacity from capacity_label for backward compatibility
          const label = firstConfig.capacity_label || '';
          // This is a fallback - the numeric value is less important now
          roomDataToSave.capacity = 2; // Default fallback
        }
        roomDataToSave.capacity_label = firstConfig.capacity_label;
      } else if (roomData.group_type === 'OTHER') {
        // OTHER rooms use capacity 0 (not null, since capacity is NOT NULL in database)
        roomDataToSave.capacity = 0;
        roomDataToSave.capacity_label = null;
      }

      console.log("Saving room data:", roomDataToSave);
      console.log("Capacity configurations count:", roomData.capacity_configurations.length);
      console.log("Capacity configurations:", JSON.stringify(roomData.capacity_configurations, null, 2));

      // Check if this is a schema cache issue and use RPC functions directly
      const isSchemaCacheError = (err: any) => {
        const errorMessage = err?.message || '';
        const errorDetails = err?.details || '';
        const errorHint = err?.hint || '';
        const fullErrorText = `${errorMessage} ${errorDetails} ${errorHint}`.toLowerCase();
        
        return err?.code === 'PGRST204' || 
               fullErrorText.includes('schema cache') || 
               fullErrorText.includes('capacity_configurations') ||
               (err?.status === 400 && (
                 fullErrorText.includes('capacity_configurations') ||
                 fullErrorText.includes('column') && fullErrorText.includes('rooms')
               ));
      };

      let data, error;

      // Always try RPC functions first for admin operations (they bypass RLS and are more reliable)
      // RPC functions work for both rooms with and without capacity_configurations
      const hasCapacityConfigs = roomData.capacity_configurations && roomData.capacity_configurations.length > 0;
      const shouldTryRpcFirst = true; // Always try RPC first to bypass RLS issues

      // Use the original capacity_configurations from roomData, not from roomDataToSave
      const capacityConfigsToSave = roomData.capacity_configurations || [];

      console.log("=== ROOM SAVE DEBUG ===");
      console.log("Has capacity configs:", hasCapacityConfigs);
      console.log("Capacity configs count:", capacityConfigsToSave.length);
      console.log("Capacity configs data:", JSON.stringify(capacityConfigsToSave, null, 2));
      console.log("Should try RPC first:", shouldTryRpcFirst);

      // Try RPC functions first if we have capacity configurations
      if (shouldTryRpcFirst) {
        try {
          const isUpdate = !!selectedRoom;
          const adminClient = supabaseAdmin;
          const rpcClient = adminClient || client;
          
          console.log("Attempting to save via RPC functions first...");
          console.log("RPC params:", {
            room_id_param: selectedRoom?.id,
            room_name: roomDataToSave.name,
            room_group_type: roomDataToSave.group_type,
            room_capacity_configurations: capacityConfigsToSave,
            room_capacity: roomDataToSave.capacity,
            room_capacity_label: roomDataToSave.capacity_label
          });
          
          if (isUpdate) {
            const rpcResult = await rpcClient.rpc('update_room_with_configurations', {
              room_id_param: selectedRoom.id,
              room_name: roomDataToSave.name,
              room_group_type: roomDataToSave.group_type,
              room_capacity_configurations: capacityConfigsToSave,
              room_capacity: roomDataToSave.capacity ?? null,
              room_capacity_label: roomDataToSave.capacity_label ?? null
            });
            
            if (rpcResult.error) {
              console.error("RPC update error:", rpcResult.error);
              throw { useRpc: false, originalError: rpcResult.error }; // Fall through to direct save
            }
            
            console.log("Successfully updated room via RPC function");
            const fetchResult = await client.from("rooms").select("*").eq("id", selectedRoom.id).single();
            if (fetchResult.data) {
              data = [fetchResult.data];
              console.log("Fetched updated room data:", data);
            }
          } else {
            const rpcResult = await rpcClient.rpc('insert_room_with_configurations', {
              room_name: roomDataToSave.name,
              room_group_type: roomDataToSave.group_type,
              room_capacity_configurations: capacityConfigsToSave,
              room_capacity: roomDataToSave.capacity ?? null,
              room_capacity_label: roomDataToSave.capacity_label ?? null
            });
            
            if (rpcResult.error) {
              console.error("RPC insert error:", rpcResult.error);
              throw { useRpc: false, originalError: rpcResult.error }; // Fall through to direct save
            }
            
            const newRoomId = rpcResult.data;
            console.log("Successfully created room via RPC function, ID:", newRoomId);
            const fetchResult = await client.from("rooms").select("*").eq("id", newRoomId).single();
            if (fetchResult.data) {
              data = [fetchResult.data];
              console.log("Fetched created room data:", data);
            }
          }
          
          // Success via RPC
          if (data) {
            const wasUpdate = !!selectedRoom;
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedRoom(null);
            await fetchRooms();
            toast({
              title: "Sukces",
              description: wasUpdate ? "Pokój został zaktualizowany pomyślnie" : "Pokój został utworzony pomyślnie",
            });
            setIsSaving(false);
            return;
          }
        } catch (rpcError: any) {
          console.warn("RPC functions failed or don't exist, trying direct save...", rpcError);
          // Fall through to direct save attempt
        }
      }

      // Try direct save
      try {
        const result = selectedRoom
          ? await client
              .from("rooms")
              .update(roomDataToSave)
              .eq("id", selectedRoom.id)
              .select()
          : await client
              .from("rooms")
              .insert([roomDataToSave])
              .select();
        
        data = result.data;
        error = result.error;

        // If successful, we're done
        if (!error && data) {
          console.log("Room saved successfully via direct method");
          
          // Clean up localStorage if it exists
          const roomId = data[0]?.id || selectedRoom?.id;
          if (roomId) {
            try {
              localStorage.removeItem(`room_config_${roomId}`);
            } catch (e) {
              console.warn("Could not clean up localStorage:", e);
            }
          }
          
          // Clear any previous error states
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedRoom(null);
          
          // Refresh rooms list
          await fetchRooms();
          
          toast({
            title: "Sukces",
            description: selectedRoom ? "Pokój został zaktualizowany pomyślnie" : "Pokój został utworzony pomyślnie",
          });
          setIsSaving(false);
          return;
        }

        // Check if it's a schema cache error
        if (error && isSchemaCacheError(error)) {
          console.warn("Schema cache error detected, using RPC functions...");
          throw { useRpc: true, originalError: error };
        }

        // If it's a different error, throw it
        if (error) throw error;
      } catch (e: any) {
        // If we should use RPC, do it
        if (e.useRpc) {
          const isUpdate = !!selectedRoom;
          
          // Try using admin client first if available (bypasses RLS, might work even with cache issues)
          const adminClient = supabaseAdmin;
          const rpcClient = adminClient || client;
          
          console.log("Fallback: Trying RPC after direct save failed...");
          console.log("Using capacity configs:", capacityConfigsToSave);
          
          try {
            if (isUpdate) {
              // Update existing room
              const rpcResult = await rpcClient.rpc('update_room_with_configurations', {
                room_id_param: selectedRoom.id,
                room_name: roomDataToSave.name,
                room_group_type: roomDataToSave.group_type,
                room_capacity_configurations: capacityConfigsToSave,
                room_capacity: roomDataToSave.capacity ?? null,
                room_capacity_label: roomDataToSave.capacity_label || null
              });
              
              if (rpcResult.error) {
                throw rpcResult.error;
              }
              
              console.log("Successfully updated room via RPC function");
              
              // Clean up localStorage
              try {
                localStorage.removeItem(`room_config_${selectedRoom.id}`);
              } catch (e) {
                console.warn("Could not clean up localStorage:", e);
              }
              
              // Fetch the updated room
              const fetchResult = await client.from("rooms").select("*").eq("id", selectedRoom.id).single();
              if (fetchResult.data) {
                data = [fetchResult.data];
              }
            } else {
              // Insert new room
              const rpcResult = await rpcClient.rpc('insert_room_with_configurations', {
                room_name: roomDataToSave.name,
                room_group_type: roomDataToSave.group_type,
                room_capacity_configurations: capacityConfigsToSave,
                room_capacity: roomDataToSave.capacity ?? null,
                room_capacity_label: roomDataToSave.capacity_label || null
              });
              
              if (rpcResult.error) {
                throw rpcResult.error;
              }
              
              const newRoomId = rpcResult.data;
              console.log("Successfully created room via RPC function, ID:", newRoomId);
              
              // Clean up localStorage if it exists
              try {
                localStorage.removeItem(`room_config_${newRoomId}`);
              } catch (e) {
                console.warn("Could not clean up localStorage:", e);
              }
              
              // Fetch the new room
              const fetchResult = await client.from("rooms").select("*").eq("id", newRoomId).single();
              if (fetchResult.data) {
                data = [fetchResult.data];
              } else {
                // Fallback: create without capacity_configurations
                console.warn("Could not fetch created room, falling back to basic save");
                const basicResult = await client
                  .from("rooms")
                  .insert([basicData])
                  .select();
                data = basicResult.data;
                error = basicResult.error;
                
                if (error) throw error;
                
                // Clear any previous error states
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setSelectedRoom(null);
                // Refresh rooms list
                await fetchRooms();
                toast({
                  title: "Pokój zapisany (częściowo)",
                  description: "Pokój został utworzony pomyślnie, ale konfiguracje pojemności nie mogły zostać jeszcze zapisane. Poczekaj 2-3 minuty na odświeżenie cache schematu, a następnie edytuj pokój, aby dodać konfiguracje pojemności.",
                  variant: "default",
                });
                setIsSaving(false);
                return;
              }
            }
            
            // Success via RPC
            // Store selectedRoom state before clearing it
            const wasUpdate = !!selectedRoom;
            
            // Clear any previous error states
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedRoom(null);
            
            // Refresh rooms list
            await fetchRooms();
            
            toast({
              title: "Sukces",
              description: wasUpdate ? "Pokój został zaktualizowany pomyślnie" : "Pokój został utworzony pomyślnie",
            });
            setIsSaving(false);
            return;
          } catch (rpcError: any) {
            console.error("RPC function failed:", rpcError);
            
            // Check if it's a 404 (function doesn't exist) or other error
            const isNotFound = rpcError?.status === 404 || rpcError?.code === 'PGRST202' || rpcError?.message?.includes('not found') || rpcError?.code === 'PGRST116';
            
            // If admin client is available, try one more time with a delay (sometimes helps)
            if (adminClient && isNotFound) {
              console.warn("RPC failed with admin client, waiting 2 seconds and retrying...");
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              try {
                if (isUpdate) {
                  const retryResult = await adminClient.rpc('update_room_with_configurations', {
                    room_id_param: selectedRoom.id,
                    room_name: roomDataToSave.name,
                    room_group_type: roomDataToSave.group_type,
                    room_capacity_configurations: capacityConfigsToSave,
                    room_capacity: roomDataToSave.capacity ?? null,
                    room_capacity_label: roomDataToSave.capacity_label || null
                  });
                  
                  if (!retryResult.error && retryResult.data) {
                    console.log("Successfully saved via admin client RPC on retry!");
                    const fetchResult = await client.from("rooms").select("*").eq("id", selectedRoom.id).single();
                    if (fetchResult.data) {
                      data = [fetchResult.data];
                      // Clear any previous error states
                      setIsCreateDialogOpen(false);
                      setIsEditDialogOpen(false);
                      setSelectedRoom(null);
                      // Refresh rooms list
                      await fetchRooms();
                      toast({
                        title: "Sukces",
                        description: "Pokój został zaktualizowany pomyślnie",
                      });
                      setIsSaving(false);
                      return;
                    }
                  }
                } else {
                  const retryResult = await adminClient.rpc('insert_room_with_configurations', {
                    room_name: roomDataToSave.name,
                    room_group_type: roomDataToSave.group_type,
                    room_capacity_configurations: capacityConfigsToSave,
                    room_capacity: roomDataToSave.capacity ?? null,
                    room_capacity_label: roomDataToSave.capacity_label || null
                  });
                  
                  if (!retryResult.error && retryResult.data) {
                    console.log("Successfully saved via admin client RPC on retry!");
                    const fetchResult = await client.from("rooms").select("*").eq("id", retryResult.data).single();
                    if (fetchResult.data) {
                      data = [fetchResult.data];
                      // Clear any previous error states
                      setIsCreateDialogOpen(false);
                      setIsEditDialogOpen(false);
                      setSelectedRoom(null);
                      // Refresh rooms list
                      await fetchRooms();
                      toast({
                        title: "Sukces",
                        description: "Pokój został utworzony pomyślnie",
                      });
                      setIsSaving(false);
                      return;
                    }
                  }
                }
              } catch (retryError: any) {
                console.warn("Admin client retry also failed:", retryError);
              }
            }
            
            // Try one more time to save with capacity_configurations directly (sometimes works even after error)
            console.warn("RPC failed, trying direct save with capacity_configurations one more time...");
            try {
              const retryResult = selectedRoom
                ? await client
                    .from("rooms")
                    .update(roomDataToSave)
                    .eq("id", selectedRoom.id)
                    .select()
                : await client
                    .from("rooms")
                    .insert([roomDataToSave])
                    .select();
              
              if (!retryResult.error && retryResult.data) {
                console.log("Successfully saved with capacity_configurations on retry!");
                
                // Clean up localStorage
                const roomId = retryResult.data[0]?.id || selectedRoom?.id;
                if (roomId) {
                  try {
                    localStorage.removeItem(`room_config_${roomId}`);
                  } catch (e) {
                    console.warn("Could not clean up localStorage:", e);
                  }
                }
                
                // Clear any previous error states
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setSelectedRoom(null);
                // Refresh rooms list
                await fetchRooms();
                toast({
                  title: "Sukces",
                  description: selectedRoom ? "Pokój został zaktualizowany pomyślnie" : "Pokój został utworzony pomyślnie",
                });
                setIsSaving(false);
                return;
              }
            } catch (retryError: any) {
              console.warn("Retry also failed, falling back to basic save");
            }
            
            // Final fallback: save without capacity_configurations
            console.warn("All methods failed, saving basic room data without capacity_configurations...");
            const { capacity_configurations: _, ...basicData } = roomDataToSave;
            
            const basicResult = selectedRoom
              ? await client
                  .from("rooms")
                  .update(basicData)
                  .eq("id", selectedRoom.id)
                  .select()
              : await client
                  .from("rooms")
                  .insert([basicData])
                  .select();
            
            if (basicResult.error) {
              throw basicResult.error;
            }
            
            data = basicResult.data;
            
            // Store capacity_configurations in localStorage as a temporary workaround
            // so user can recover it when they edit
            if (capacityConfigsToSave && capacityConfigsToSave.length > 0) {
              const roomId = data?.[0]?.id || selectedRoom?.id;
              if (roomId) {
                try {
                  localStorage.setItem(`room_config_${roomId}`, JSON.stringify({
                    capacity_configurations: capacityConfigsToSave,
                    timestamp: Date.now()
                  }));
                  console.log("Stored capacity_configurations in localStorage for recovery");
                } catch (e) {
                  console.warn("Could not store in localStorage:", e);
                }
              }
            }
            
            const errorMsg = isNotFound 
              ? "Room saved successfully! Capacity configurations are temporarily stored locally because PostgREST can't see the database functions yet. To fix: 1) Run 'supabase/force_postgrest_refresh.sql' in SQL Editor, 2) Restart your Supabase project (Settings → General → Restart), 3) Wait 3-5 minutes, then edit this room again. Your configurations will be saved automatically."
              : "Room saved successfully! Capacity configurations are temporarily stored locally. PostgREST schema cache needs to refresh. Please restart your Supabase project (Settings → General → Restart), wait 3-5 minutes, then edit this room again. Your configurations will be saved automatically.";
            
            // Clear any previous error states
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedRoom(null);
            // Refresh rooms list
            await fetchRooms();
            toast({
              title: "Room saved (partial)",
              description: errorMsg,
              variant: "default",
            });
            setIsSaving(false);
            return;
          }
        } else {
          // Re-throw other errors
          error = e;
        }
      }

      if (error) {
        console.error("Supabase error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log("Room saved successfully:", data);

      // Store selectedRoom state before clearing it
      const wasUpdate = !!selectedRoom;
      
      // Clear any previous error states
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setSelectedRoom(null);
      
      // Refresh rooms list
      await fetchRooms();

      toast({
        title: "Sukces",
        description: wasUpdate ? "Pokój został zaktualizowany pomyślnie" : "Pokój został utworzony pomyślnie",
      });
    } catch (error: any) {
      console.error("Error saving room - full error:", error);
      console.error("Error message:", error?.message);
      console.error("Error details:", error?.details);
      toast({
        title: "Błąd",
        description: `Nie udało się ${selectedRoom ? "zaktualizować" : "utworzyć"} pokoju: ${error?.message || error?.details || "Nieznany błąd"}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      setIsDeleting(true);
      // Prefer admin client to bypass RLS, but fallback to regular client
      const client = supabaseAdmin || supabase;
      const rpcClient = supabaseAdmin || supabase;

      console.log("Deleting room:", roomId);
      console.log("Using client:", supabaseAdmin ? "admin (bypasses RLS)" : "regular (subject to RLS)");

      // Try RPC function first (bypasses RLS)
      try {
        console.log("Attempting to delete via RPC function...");
        const rpcResult = await rpcClient.rpc('delete_room', {
          room_id_param: roomId
        });

        if (rpcResult.error) {
          console.error("RPC delete error:", rpcResult.error);
          throw rpcResult.error;
        }

        console.log("Successfully deleted room via RPC function");
      } catch (rpcError: any) {
        // If RPC function doesn't exist or fails, fall back to direct delete
        console.warn("RPC delete failed, trying direct delete...", rpcError);
        
        const { data, error } = await client
          .from("rooms")
          .delete()
          .eq("id", roomId)
          .select(); // Select to verify deletion

        console.log("Direct delete result:", { data, error });

        if (error) {
          console.error("Delete error details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          throw error;
        }

        // Verify the room was actually deleted
        if (data && data.length === 0) {
          console.warn("Delete returned no data - room may not have been deleted");
          // Try to verify by fetching the room
          const { data: verifyData, error: verifyError } = await client
            .from("rooms")
            .select("id")
            .eq("id", roomId)
            .maybeSingle();
          
          if (verifyData) {
            throw new Error("Room still exists in database after delete operation. RLS policy may be blocking deletion.");
          }
        }
      }

      // Refresh rooms list before showing success message
      await fetchRooms();

      toast({
        title: "Sukces",
        description: "Pokój został usunięty pomyślnie",
      });
    } catch (error: any) {
      console.error("Error deleting room:", error);
      const errorMessage = error?.message || error?.details || "Nieznany błąd";
      toast({
        title: "Błąd",
        description: `Nie udało się usunąć pokoju: ${errorMessage}. ${error?.hint || ''}`,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = async (room: Room) => {
    try {
      // Fetch the latest room data to ensure we have the most up-to-date information
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", room.id)
        .single();

      if (error) {
        console.error("Error fetching room for edit:", error);
        // Fallback to using the room from the list
        setSelectedRoom(room);
      } else {
        setSelectedRoom(data);
      }
      setIsEditDialogOpen(true);
    } catch (error: any) {
      console.error("Error opening edit dialog:", error);
      // Fallback to using the room from the list
      setSelectedRoom(room);
      setIsEditDialogOpen(true);
    }
  };

  const getGroupBadge = (group: RoomGroup) => {
    const config: Record<RoomGroup, { label: string; className: string }> = {
      P1: { label: "P1", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-blue-900/30 dark:hover:text-blue-200" },
      P2: { label: "P2", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 hover:bg-purple-100 hover:text-purple-800 dark:hover:bg-purple-900/30 dark:hover:text-purple-200" },
      A1S: { label: "A1S", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 hover:bg-green-100 hover:text-green-800 dark:hover:bg-green-900/30 dark:hover:text-green-200" },
      A2S: { label: "A2S", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200 hover:bg-cyan-100 hover:text-cyan-800 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-200" },
      OTHER: { label: "Other", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-900/30 dark:hover:text-gray-200" },
    };
    const { label, className } = config[group] || { label: group, className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-900/30 dark:hover:text-gray-200" };
    return <Badge className={className}>{label}</Badge>;
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Zarządzanie pokojami</h2>
          <p className="text-muted-foreground">Zarządzaj pokojami hotelowymi i innymi lokalizacjami</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Utwórz Pokój
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-lg">Filtry</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <div className="grid gap-4 md:grid-cols-1 max-w-xs">
            <div className="space-y-2">
              <Label htmlFor="group-filter">Typ Grupy</Label>
              <Select value={groupFilter} onValueChange={(value: RoomGroup | "all") => setGroupFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie Typy</SelectItem>
                  <SelectItem value="P1">P1</SelectItem>
                  <SelectItem value="P2">P2</SelectItem>
                  <SelectItem value="A1S">A1S</SelectItem>
                  <SelectItem value="A2S">A2S</SelectItem>
                  <SelectItem value="OTHER">Inne Lokalizacje</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Table - Simplified */}
      <Card>
        <CardHeader>
          <CardTitle>Pokoje ({filteredRooms.length})</CardTitle>
          <CardDescription>
            Kliknij edytuj, aby skonfigurować opcje pojemności i typy sprzątania dla każdego pokoju
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[calc(8*3.5rem)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 sticky top-0 z-10">
                  <TableHead>Pokój</TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 data-[state=open]:bg-accent"
                      onClick={toggleTypeSort}
                    >
                      Typ
                      {typeSortDirection === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
                      {typeSortDirection === "desc" && <ArrowDown className="ml-2 h-4 w-4" />}
                      {typeSortDirection === null && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 data-[state=open]:bg-accent"
                      onClick={toggleCreatedSort}
                    >
                      Utworzono
                      {createdSortDirection === "asc" && <ArrowUp className="ml-2 h-4 w-4" />}
                      {createdSortDirection === "desc" && <ArrowDown className="ml-2 h-4 w-4" />}
                      {createdSortDirection === null && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRooms.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4 text-muted-foreground" />
                        {room.name}
                      </div>
                    </TableCell>
                    <TableCell>{getGroupBadge(room.group_type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(room.created_at || new Date()).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(room)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Usuń pokój</AlertDialogTitle>
                              <AlertDialogDescription>
                                Czy na pewno chcesz usunąć ten pokój? Ta akcja nie może zostać cofnięta i trwale usunie pokój z systemu.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Anuluj</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRoom(room.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={isDeleting}
                              >
                                {isDeleting ? "Usuwanie..." : "Usuń"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <RoomConfigurationDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        room={null}
        onSave={handleSaveRoom}
        isSaving={isSaving}
      />

      {/* Edit Dialog */}
      <RoomConfigurationDialog
        isOpen={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedRoom(null);
        }}
        room={selectedRoom}
        onSave={handleSaveRoom}
        isSaving={isSaving}
      />
    </div>
  );
}
