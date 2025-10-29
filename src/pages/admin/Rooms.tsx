import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, DoorOpen, Users, Calendar, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin, isAdminClientAvailable } from "@/integrations/supabase/admin-client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

// Guest count options based on room group type (same as AddTaskDialog)
type GuestOption = {
  value: number;
  label: string;
  display: React.ReactNode;
};

const getGuestCountOptions = (roomGroup: RoomGroup | null): GuestOption[] => {
  if (!roomGroup) return [];

  const renderIcons = (config: string): React.ReactNode => {
    // Parse configurations like "1", "2", "1+1", "2+2", "2+2+2"
    const parts = config.split('+').map(p => parseInt(p.trim()));
    
    return (
      <div className="flex items-center gap-1">
        {parts.map((count, partIndex) => {
          const icons = [];
          for (let i = 0; i < count; i++) {
            icons.push(<User key={`${partIndex}-${i}`} className="h-4 w-4 text-muted-foreground" />);
          }
          return (
            <div key={partIndex} className="flex items-center gap-0.5">
              {icons}
              {partIndex < parts.length - 1 && <span className="mx-0.5 text-muted-foreground">+</span>}
            </div>
          );
        })}
      </div>
    );
  };

  switch (roomGroup) {
    case 'P1':
      return [{ value: 1, label: '1', display: renderIcons('1') }];
    
    case 'P2':
      return [
        { value: 1, label: '1', display: renderIcons('1') },
        { value: 2, label: '2', display: renderIcons('2') },
        { value: 2, label: '1+1', display: renderIcons('1+1') },
      ];
    
    case 'A1S':
      return [
        { value: 1, label: '1', display: renderIcons('1') },
        { value: 2, label: '2', display: renderIcons('2') },
        { value: 2, label: '1+1', display: renderIcons('1+1') },
        { value: 3, label: '2+1', display: renderIcons('2+1') },
        { value: 4, label: '2+2', display: renderIcons('2+2') },
      ];
    
    case 'A2S':
      return [
        { value: 1, label: '1', display: renderIcons('1') },
        { value: 2, label: '2', display: renderIcons('2') },
        { value: 2, label: '1+1', display: renderIcons('1+1') },
        { value: 3, label: '2+1', display: renderIcons('2+1') },
        { value: 4, label: '2+2', display: renderIcons('2+2') },
        { value: 3, label: '1+1+1', display: renderIcons('1+1+1') },
        { value: 5, label: '2+2+1', display: renderIcons('2+2+1') },
        { value: 6, label: '2+2+2', display: renderIcons('2+2+2') },
      ];
    
    case 'OTHER':
      // Default options for other locations
      return Array.from({ length: 10 }, (_, i) => ({
        value: i + 1,
        label: String(i + 1),
        display: renderIcons(String(i + 1)),
      }));
    
    default:
      return [];
  }
};

// Get maximum capacity for a room group
const getMaxCapacity = (roomGroup: RoomGroup | null): number => {
  if (!roomGroup) return 1;
  const options = getGuestCountOptions(roomGroup);
  if (options.length === 0) return 1;
  return Math.max(...options.map(opt => opt.value));
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

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: "",
    group_type: "P1" as RoomGroup,
    capacity: 1, // Default to 1 for P1
  });

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

  // Reset form data when create dialog closes
  useEffect(() => {
    if (!isCreateDialogOpen) {
      setFormData({
        name: "",
        group_type: "P1",
        capacity: 1, // Default to 1 for P1
      });
    }
  }, [isCreateDialogOpen]);

  // Update capacity when group type changes
  useEffect(() => {
    if (isCreateDialogOpen || isEditDialogOpen) {
      const maxCapacity = getMaxCapacity(formData.group_type);
      const options = getGuestCountOptions(formData.group_type);
      // Set to first available option or max capacity
      const defaultCapacity = options.length > 0 ? options[0].value : maxCapacity;
      setFormData(prev => ({ ...prev, capacity: defaultCapacity }));
    }
  }, [formData.group_type, isCreateDialogOpen, isEditDialogOpen]);

  const filteredRooms = rooms.filter(room => {
    const matchesGroup = groupFilter === "all" || room.group_type === groupFilter;
    return matchesGroup;
  });

  const handleCreateRoom = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Room name is required",
        variant: "destructive",
      });
      return;
    }

    // Validate capacity based on room group
    const maxCapacity = getMaxCapacity(formData.group_type);
    const capacityOptions = getGuestCountOptions(formData.group_type);
    const validCapacities = capacityOptions.map(opt => opt.value);
    
    if (!validCapacities.includes(formData.capacity)) {
      toast({
        title: "Validation Error",
        description: `Capacity must be one of the valid options for ${formData.group_type} rooms (max: ${maxCapacity})`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Use admin client to bypass RLS for admin operations
      const client = supabaseAdmin || supabase;
      
      if (!supabaseAdmin && isAdminClientAvailable()) {
        toast({
          title: "Warning",
          description: "Admin client not available. Using regular client.",
          variant: "default",
        });
      }

      const { error } = await client
        .from("rooms")
        .insert([formData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Room created successfully",
      });

      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        group_type: "P1",
        capacity: 2,
      });
      fetchRooms();
    } catch (error: any) {
      console.error("Error creating room:", error);
      toast({
        title: "Error",
        description: `Failed to create room: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleEditRoom = async () => {
    if (!selectedRoom) return;

    // Validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Room name is required",
        variant: "destructive",
      });
      return;
    }

    // Validate capacity based on room group
    const maxCapacity = getMaxCapacity(formData.group_type);
    const capacityOptions = getGuestCountOptions(formData.group_type);
    const validCapacities = capacityOptions.map(opt => opt.value);
    
    if (!validCapacities.includes(formData.capacity)) {
      toast({
        title: "Validation Error",
        description: `Capacity must be one of the valid options for ${formData.group_type} rooms (max: ${maxCapacity})`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Use admin client to bypass RLS for admin operations
      const client = supabaseAdmin || supabase;
      
      const { error } = await client
        .from("rooms")
        .update(formData)
        .eq("id", selectedRoom.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Room updated successfully",
      });

      setIsEditDialogOpen(false);
      setSelectedRoom(null);
      fetchRooms();
    } catch (error: any) {
      console.error("Error updating room:", error);
      toast({
        title: "Error",
        description: `Failed to update room: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      setIsDeleting(true);
      // Use admin client to bypass RLS for admin operations
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

  const openEditDialog = (room: Room) => {
    setSelectedRoom(room);
    setFormData({
      name: room.name,
      group_type: room.group_type,
      capacity: room.capacity,
    });
    setIsEditDialogOpen(true);
  };

  const getGroupBadge = (group: RoomGroup) => {
    const config: Record<RoomGroup, { label: string; className: string }> = {
      P1: { label: "P1", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
      P2: { label: "P2", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200" },
      A1S: { label: "A1S", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" },
      A2S: { label: "A2S", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200" },
      OTHER: { label: "Other", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200" },
    };
    const { label, className } = config[group] || { label: group, className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200" };
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
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Room</DialogTitle>
              <DialogDescription>
                Add a new room or location to the system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Room Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Room 101, Conference Room A"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group_type">Group Type *</Label>
                <Select value={formData.group_type} onValueChange={(value: RoomGroup) => setFormData({ ...formData, group_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P1">P1</SelectItem>
                    <SelectItem value="P2">P2</SelectItem>
                    <SelectItem value="A1S">A1S</SelectItem>
                    <SelectItem value="A2S">A2S</SelectItem>
                    <SelectItem value="OTHER">Other Location</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Select
                  value={(() => {
                    const options = getGuestCountOptions(formData.group_type);
                    const matchingOption = options.find(opt => opt.value === formData.capacity);
                    return matchingOption ? `${matchingOption.value}-${matchingOption.label}` : String(formData.capacity);
                  })()}
                  onValueChange={(value) => {
                    // Extract numeric value from composite "value-label" format
                    const numericValue = parseInt(value.split('-')[0], 10);
                    setFormData(prev => ({ ...prev, capacity: numericValue }));
                  }}
                >
                  <SelectTrigger id="capacity">
                    <SelectValue placeholder="Select capacity" />
                  </SelectTrigger>
                  <SelectContent>
                    {getGuestCountOptions(formData.group_type).map((option, index) => {
                      const uniqueValue = `${option.value}-${option.label}`;
                      return (
                        <SelectItem key={`${option.value}-${option.label}-${index}`} value={uniqueValue}>
                          {option.display}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRoom}>
                Create Room
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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

      {/* Rooms Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rooms ({filteredRooms.length})</CardTitle>
          <CardDescription>
            Manage all rooms and locations in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRooms.map((room) => (
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
                      {(() => {
                        const options = getGuestCountOptions(room.group_type);
                        const matchingOption = options.find(opt => opt.value === room.capacity);
                        return matchingOption ? matchingOption.display : (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(room.capacity, 6) }, (_, i) => (
                              <User key={i} className="h-4 w-4 text-muted-foreground" />
                            ))}
                            {room.capacity > 6 && <span className="text-xs text-muted-foreground">+{room.capacity - 6}</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {new Date(room.created_at).toLocaleDateString()}
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>
              Update room information and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Room Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-group_type">Group Type *</Label>
              <Select value={formData.group_type} onValueChange={(value: RoomGroup) => setFormData({ ...formData, group_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="P1">P1</SelectItem>
                  <SelectItem value="P2">P2</SelectItem>
                  <SelectItem value="A1S">A1S</SelectItem>
                  <SelectItem value="A2S">A2S</SelectItem>
                  <SelectItem value="OTHER">Other Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-capacity">Capacity</Label>
              <Select
                value={(() => {
                  const options = getGuestCountOptions(formData.group_type);
                  const matchingOption = options.find(opt => opt.value === formData.capacity);
                  return matchingOption ? `${matchingOption.value}-${matchingOption.label}` : String(formData.capacity);
                })()}
                onValueChange={(value) => {
                  // Extract numeric value from composite "value-label" format
                  const numericValue = parseInt(value.split('-')[0], 10);
                  setFormData(prev => ({ ...prev, capacity: numericValue }));
                }}
              >
                <SelectTrigger id="edit-capacity">
                  <SelectValue placeholder="Select capacity" />
                </SelectTrigger>
                <SelectContent>
                  {getGuestCountOptions(formData.group_type).map((option, index) => {
                    const uniqueValue = `${option.value}-${option.label}`;
                    return (
                      <SelectItem key={`${option.value}-${option.label}-${index}`} value={uniqueValue}>
                        {option.display}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditRoom}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
