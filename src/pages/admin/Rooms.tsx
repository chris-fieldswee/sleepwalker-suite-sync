import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, DoorOpen, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/admin-client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { RoomConfigurationDialog } from "@/components/admin/RoomConfigurationDialog";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

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
        title: "Error",
        description: "Failed to fetch rooms",
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

  const displayedRooms = (typeSortDirection
    ? [...filteredRooms].sort((a, b) => {
        const aOrder = roomTypeOrder[a.group_type] ?? 999;
        const bOrder = roomTypeOrder[b.group_type] ?? 999;
        return typeSortDirection === "asc" ? aOrder - bOrder : bOrder - aOrder;
      })
    : filteredRooms);

  const toggleTypeSort = () => {
    setTypeSortDirection(prev => (prev === "asc" ? "desc" : prev === "desc" ? null : "asc"));
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
      const client = supabaseAdmin || supabase;
      
      // Prepare the data object
      const roomDataToSave: any = {
        name: roomData.name,
        group_type: roomData.group_type,
        capacity_configurations: roomData.capacity_configurations || [],
      };

      // For non-OTHER rooms, set legacy fields for backward compatibility
      if (roomData.group_type !== 'OTHER' && roomData.capacity_configurations.length > 0) {
        roomDataToSave.capacity = roomData.capacity_configurations[0].capacity;
        roomDataToSave.capacity_label = roomData.capacity_configurations[0].capacity_label;
      } else if (roomData.group_type === 'OTHER') {
        roomDataToSave.capacity = null;
        roomDataToSave.capacity_label = null;
      }

      console.log("Saving room data:", roomDataToSave);

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

      // Try direct save first
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
          
          toast({
            title: "Success",
            description: selectedRoom ? "Room updated successfully" : "Room created successfully",
          });
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedRoom(null);
          fetchRooms();
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
          const { capacity_configurations, ...basicData } = roomDataToSave;
          const isUpdate = !!selectedRoom;
          
          try {
            if (isUpdate) {
              // Update existing room
              const rpcResult = await client.rpc('update_room_with_configurations', {
                room_id_param: selectedRoom.id,
                room_name: roomDataToSave.name,
                room_group_type: roomDataToSave.group_type,
                room_capacity_configurations: capacity_configurations || [],
                room_capacity: roomDataToSave.capacity || null,
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
              const rpcResult = await client.rpc('insert_room_with_configurations', {
                room_name: roomDataToSave.name,
                room_group_type: roomDataToSave.group_type,
                room_capacity_configurations: capacity_configurations || [],
                room_capacity: roomDataToSave.capacity || null,
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
                
                toast({
                  title: "Room saved (partial)",
                  description: "Room created successfully, but capacity configurations couldn't be saved yet. Please wait 2-3 minutes for schema cache refresh, then edit the room to add capacity configurations.",
                  variant: "default",
                });
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setSelectedRoom(null);
                fetchRooms();
                setIsSaving(false);
                return;
              }
            }
            
            // Success via RPC
            toast({
              title: "Success",
              description: selectedRoom ? "Room updated successfully" : "Room created successfully",
            });
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedRoom(null);
            fetchRooms();
            setIsSaving(false);
            return;
          } catch (rpcError: any) {
            console.error("RPC function failed:", rpcError);
            
            // Check if it's a 404 (function doesn't exist) or other error
            const isNotFound = rpcError?.status === 404 || rpcError?.code === 'PGRST202' || rpcError?.message?.includes('not found') || rpcError?.code === 'PGRST116';
            
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
                
                toast({
                  title: "Success",
                  description: selectedRoom ? "Room updated successfully" : "Room created successfully",
                });
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setSelectedRoom(null);
                fetchRooms();
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
            if (capacity_configurations && capacity_configurations.length > 0) {
              const roomId = data?.[0]?.id || selectedRoom?.id;
              if (roomId) {
                try {
                  localStorage.setItem(`room_config_${roomId}`, JSON.stringify({
                    capacity_configurations,
                    timestamp: Date.now()
                  }));
                  console.log("Stored capacity_configurations in localStorage for recovery");
                } catch (e) {
                  console.warn("Could not store in localStorage:", e);
                }
              }
            }
            
            const errorMsg = isNotFound 
              ? "Room saved, but capacity configurations are temporarily stored locally. The database functions need PostgREST cache refresh. Please restart your Supabase project (Settings → General → Restart), wait 2-3 minutes, then edit this room again. Your configurations will be saved automatically."
              : "Room saved, but capacity configurations are temporarily stored locally. PostgREST schema cache needs to refresh. Please restart your Supabase project (Settings → General → Restart), wait 2-3 minutes, then edit this room again. Your configurations will be saved automatically.";
            
            toast({
              title: "Room saved (partial)",
              description: errorMsg,
              variant: "default",
            });
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setSelectedRoom(null);
            fetchRooms();
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

      toast({
        title: "Success",
        description: selectedRoom ? "Room updated successfully" : "Room created successfully",
      });

      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setSelectedRoom(null);
      fetchRooms();
    } catch (error: any) {
      console.error("Error saving room - full error:", error);
      console.error("Error message:", error?.message);
      console.error("Error details:", error?.details);
      toast({
        title: "Error",
        description: `Failed to ${selectedRoom ? "update" : "create"} room: ${error?.message || error?.details || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      setIsDeleting(true);
      // Prefer admin client, but fallback to regular client (requires RLS policy for admins)
      const client = supabaseAdmin || supabase;

      const { error } = await client
        .from("rooms")
        .delete()
        .eq("id", roomId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Room deleted successfully",
      });

      fetchRooms();
    } catch (error: any) {
      console.error("Error deleting room:", error);
      toast({
        title: "Error",
        description: `Failed to delete room: ${error.message}`,
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
          <h2 className="text-2xl font-bold">Room Management</h2>
          <p className="text-muted-foreground">Manage hotel rooms and other locations</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Room
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-1 max-w-xs">
            <div className="space-y-2">
              <Label htmlFor="group-filter">Group Type</Label>
              <Select value={groupFilter} onValueChange={(value: RoomGroup | "all") => setGroupFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="P1">P1</SelectItem>
                  <SelectItem value="P2">P2</SelectItem>
                  <SelectItem value="A1S">A1S</SelectItem>
                  <SelectItem value="A2S">A2S</SelectItem>
                  <SelectItem value="OTHER">Other Locations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Table - Simplified */}
      <Card>
        <CardHeader>
          <CardTitle>Rooms ({filteredRooms.length})</CardTitle>
          <CardDescription>
            Click edit to configure capacity options and cleaning types for each room
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={toggleTypeSort}
                    className="inline-flex items-center gap-1 hover:underline"
                    title="Sort by room type"
                  >
                    Type
                  </button>
                </TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                            <AlertDialogTitle>Delete Room</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this room? This action cannot be undone and will permanently remove the room from the system.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRoom(room.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={isDeleting}
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
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
