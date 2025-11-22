import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { getCapacitySortKey, normalizeCapacityLabel } from "@/lib/capacity-utils";

type RoomGroup = Database["public"]["Enums"]["room_group"];
type CleaningType = Database["public"]["Enums"]["cleaning_type"];

type CapacityConfiguration = {
  capacity: number;
  capacity_label: string;
  cleaning_types: {
    type: CleaningType;
    time_limit: number;
  }[];
};

type SelectedCapacity = {
  capacity: number;
  capacity_label: string;
};

type RoomCleaningType = {
  type: CleaningType;
  time_limit: number;
};

type Room = Database["public"]["Tables"]["rooms"]["Row"];

interface RoomConfigurationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room | null;
  onSave: (roomData: {
    name: string;
    group_type: RoomGroup;
    capacity_configurations: CapacityConfiguration[];
  }) => Promise<void>;
  isSaving: boolean;
}

const cleaningTypeLabels: Record<CleaningType, string> = {
  W: "Wyjazd",
  P: "Przyjazd",
  T: "Trakt",
  O: "Odświeżenie",
  G: "Generalne",
  S: "Standard"
};

const availableCleaningTypes: Record<RoomGroup, CleaningType[]> = {
  P1: ['W', 'P', 'T', 'O', 'G'],
  P2: ['W', 'P', 'T', 'O', 'G'],
  A1S: ['W', 'P', 'T', 'O', 'G'],
  A2S: ['W', 'P', 'T', 'O', 'G'],
  OTHER: ['S', 'G']
};

const renderIcons = (config: string): React.ReactNode => {
  const normalized = normalizeCapacityLabel(config);
  const rawParts = normalized.includes("+") ? normalized.split("+") : [normalized];
  const parts = rawParts
    .map((part) => parseInt(part.trim(), 10))
    .filter((count) => !Number.isNaN(count) && count > 0);

  if (parts.length === 0) {
    const fallback = parseInt(normalized, 10);
    if (!Number.isNaN(fallback) && fallback > 0) {
      parts.push(fallback);
    } else {
      parts.push(1);
    }
  }
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

// Get ALL available capacity options (not filtered by group type)
// Admin can select any capacity option for any room
const getAllCapacityOptions = (): Array<{ value: number; label: string; display: React.ReactNode }> => {
  const allOptions = new Map<string, { value: number; label: string; display: React.ReactNode }>();

  const options = [
    // P1 options
    { value: 1, label: '1', display: renderIcons('1') },
    
    // P2 options
    { value: 1, label: '1', display: renderIcons('1') },
    { value: 2, label: '2', display: renderIcons('2') },
    { value: 2, label: '1+1', display: renderIcons('1+1') },
    
    // A1S options
    { value: 1, label: '1', display: renderIcons('1') },
    { value: 2, label: '2', display: renderIcons('2') },
    { value: 2, label: '1+1', display: renderIcons('1+1') },
    { value: 3, label: '2+1', display: renderIcons('2+1') },
    { value: 4, label: '2+2', display: renderIcons('2+2') },
    
    // A2S options
    { value: 1, label: '1', display: renderIcons('1') },
    { value: 2, label: '2', display: renderIcons('2') },
    { value: 2, label: '1+1', display: renderIcons('1+1') },
    { value: 3, label: '2+1', display: renderIcons('2+1') },
    { value: 4, label: '2+2', display: renderIcons('2+2') },
    { value: 3, label: '1+1+1', display: renderIcons('1+1+1') },
    { value: 5, label: '2+2+1', display: renderIcons('2+2+1') },
    { value: 6, label: '2+2+2', display: renderIcons('2+2+2') },
  ];

  options.forEach(option => {
    const normalizedLabel = normalizeCapacityLabel(option.label);

    if (!allOptions.has(normalizedLabel)) {
      allOptions.set(normalizedLabel, {
        value: option.value,
        label: normalizedLabel,
        display: option.display ?? renderIcons(normalizedLabel)
      });
    }
  });

  return Array.from(allOptions.values()).sort((a, b) => {
    return getCapacitySortKey(a.label) - getCapacitySortKey(b.label);
  });
};

// Legacy function kept for backward compatibility (not used anymore)
const getGuestCountOptions = (roomGroup: RoomGroup): Array<{ value: number; label: string; display: React.ReactNode }> => {
  // Now returns all options regardless of group type
  return getAllCapacityOptions();
};

export function RoomConfigurationDialog({
  isOpen,
  onOpenChange,
  room,
  onSave,
  isSaving
}: RoomConfigurationDialogProps) {
  const [name, setName] = useState("");
  const [groupType, setGroupType] = useState<RoomGroup | null>(null);
  const [selectedCapacities, setSelectedCapacities] = useState<SelectedCapacity[]>([]);
  const [cleaningTypes, setCleaningTypes] = useState<RoomCleaningType[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (room) {
        setName(room.name);
        setGroupType(room.group_type);
        
        // Parse existing capacity_configurations or create from legacy fields
        let parsedCapacities: SelectedCapacity[] = [];
        let parsedCleaningTypes: RoomCleaningType[] = [];
        
        // Parse capacity_configurations - handle both string and object formats
        let capacityConfigs: any[] = [];
        try {
          if (typeof room.capacity_configurations === 'string') {
            capacityConfigs = JSON.parse(room.capacity_configurations);
          } else if (Array.isArray(room.capacity_configurations)) {
            capacityConfigs = room.capacity_configurations;
          }
        } catch (e) {
          console.error("Error parsing capacity_configurations:", e);
          capacityConfigs = [];
        }
        
        // Check localStorage for temporarily stored configurations
        let localStorageConfigs: any = null;
        try {
          const stored = localStorage.getItem(`room_config_${room.id}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            // Use if less than 1 hour old
            if (parsed.timestamp && (Date.now() - parsed.timestamp) < 3600000) {
              localStorageConfigs = parsed.capacity_configurations;
              console.log("Found stored capacity_configurations in localStorage");
            } else {
              // Clean up old data
              localStorage.removeItem(`room_config_${room.id}`);
            }
          }
        } catch (e) {
          console.warn("Error reading from localStorage:", e);
        }
        
        // Use localStorage data if database doesn't have it
        if (!capacityConfigs || capacityConfigs.length === 0) {
          if (localStorageConfigs && Array.isArray(localStorageConfigs)) {
            capacityConfigs = localStorageConfigs;
            console.log("Using capacity_configurations from localStorage");
          }
        }
        
        console.log("Loading room data:", {
          capacity_configurations: room.capacity_configurations,
          parsed_configs: capacityConfigs,
          capacity: room.capacity,
          capacity_label: room.capacity_label,
          fromLocalStorage: !!localStorageConfigs
        });
        
        if (capacityConfigs && capacityConfigs.length > 0) {
          // Extract unique capacities
          const capacityMap = new Map<string, SelectedCapacity>();
          const allCleaningTypes = new Map<CleaningType, number>();
          
          capacityConfigs.forEach((config: any) => {
            console.log("Processing config:", config);
            if (!config || typeof config !== 'object') return;
            
            const capacity = Number(config.capacity);
            const capacityLabel = config.capacity_label || String(capacity);
            const capacityKey = `${capacity}-${capacityLabel}`;
            
            if (!capacityMap.has(capacityKey) && !isNaN(capacity)) {
              capacityMap.set(capacityKey, {
                capacity: capacity,
                capacity_label: capacityLabel
              });
            }
            
            // Collect all cleaning types (use the first time_limit found for each type)
            if (Array.isArray(config.cleaning_types) && config.cleaning_types.length > 0) {
              config.cleaning_types.forEach((ct: any) => {
                if (ct && typeof ct === 'object' && ct.type && !allCleaningTypes.has(ct.type)) {
                  allCleaningTypes.set(ct.type, Number(ct.time_limit) || 30);
                }
              });
            }
          });
          
          parsedCapacities = Array.from(capacityMap.values());
          parsedCleaningTypes = Array.from(allCleaningTypes.entries()).map(([type, time_limit]) => ({
            type,
            time_limit
          }));
          
          console.log("Parsed data:", {
            capacities: parsedCapacities,
            cleaningTypes: parsedCleaningTypes
          });
        } else if (room.capacity !== null && room.group_type !== 'OTHER') {
          // Migrate from legacy single capacity
          parsedCapacities = [{
            capacity: room.capacity,
            capacity_label: room.capacity_label || String(room.capacity)
          }];
        } else if (room.group_type === 'OTHER') {
          // For OTHER rooms, check if cleaning_types are stored in the legacy field
          if (room.cleaning_types) {
            try {
              let cleaningTypesArray: string[] = [];
              if (typeof room.cleaning_types === 'string') {
                cleaningTypesArray = JSON.parse(room.cleaning_types);
              } else if (Array.isArray(room.cleaning_types)) {
                cleaningTypesArray = room.cleaning_types;
              }
              
              // Convert to RoomCleaningType format with default time limits
              parsedCleaningTypes = cleaningTypesArray
                .filter((type: string) => type === 'S' || type === 'G') // Only S and G for OTHER
                .map((type: string) => ({
                  type: type as CleaningType,
                  time_limit: 30 // Default time limit, can be adjusted
                }));
            } catch (e) {
              console.error("Error parsing cleaning_types for OTHER room:", e);
            }
          }
        }
        
        setSelectedCapacities(parsedCapacities);
        setCleaningTypes(parsedCleaningTypes);
      } else {
        setName("");
        setGroupType(null);
        setSelectedCapacities([]);
        setCleaningTypes([]);
      }
    }
  }, [isOpen, room]);

  const handleToggleCapacity = (option: { value: number; label: string }) => {
    const capacityKey = `${option.value}-${option.label}`;
    const exists = selectedCapacities.some(
      cap => cap.capacity === option.value && cap.capacity_label === option.label
    );
    
    if (exists) {
      setSelectedCapacities(selectedCapacities.filter(
        cap => !(cap.capacity === option.value && cap.capacity_label === option.label)
      ));
    } else {
      setSelectedCapacities([...selectedCapacities, {
        capacity: option.value,
        capacity_label: option.label
      }]);
    }
  };

  const isCapacitySelected = (option: { value: number; label: string }): boolean => {
    const isSelected = selectedCapacities.some(
      cap => {
        // Compare both capacity value and label
        // Handle cases where label might be a number string vs actual string
        const capLabelMatch = cap.capacity_label === option.label || 
                              String(cap.capacity_label) === String(option.label);
        const capValueMatch = cap.capacity === option.value;
        return capValueMatch && capLabelMatch;
      }
    );
    return isSelected;
  };

  const handleAddCleaningType = () => {
    if (!groupType) return;
    const available = availableCleaningTypes[groupType];
    const existingTypes = cleaningTypes.map(ct => ct.type);
    const firstAvailable = available.find(type => !existingTypes.includes(type));
    
    if (firstAvailable) {
      setCleaningTypes([...cleaningTypes, {
        type: firstAvailable,
        time_limit: 30
      }]);
    }
  };

  const handleRemoveCleaningType = (index: number) => {
    setCleaningTypes(cleaningTypes.filter((_, i) => i !== index));
  };

  const handleUpdateCleaningType = (
    index: number,
    updates: Partial<{ type: CleaningType; time_limit: number }>
  ) => {
    setCleaningTypes(cleaningTypes.map((ct, i) =>
      i === index ? { ...ct, ...updates } : ct
    ));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }
    if (!groupType) {
      return;
    }
    
    // Validate configurations for non-OTHER rooms - at least one capacity option is required
    if (groupType !== 'OTHER' && selectedCapacities.length === 0) {
      return;
    }

    // Transform the separate capacities and cleaning types into capacity_configurations format
    // Each capacity gets all cleaning types (since they're defined at room level)
    // For OTHER rooms, we still need to save cleaning types even without capacity configurations
    const capacityConfigurations: CapacityConfiguration[] = selectedCapacities.map(capacity => ({
      capacity: capacity.capacity,
      capacity_label: capacity.capacity_label,
      cleaning_types: cleaningTypes
    }));

    // For OTHER rooms, create a dummy capacity configuration with cleaning types if cleaning types are defined
    // This ensures cleaning types are saved even for OTHER rooms
    let finalCapacityConfigurations = capacityConfigurations;
    if (groupType === 'OTHER' && cleaningTypes.length > 0) {
      // Create a placeholder capacity configuration for OTHER rooms to store cleaning types
      // The capacity value doesn't matter for OTHER rooms, but we need the structure
      finalCapacityConfigurations = [{
        capacity: 0,
        capacity_label: 'N/A',
        cleaning_types: cleaningTypes
      }];
    }

    await onSave({
      name: name.trim(),
      group_type: groupType,
      capacity_configurations: finalCapacityConfigurations
    });
  };

  // Show all capacity options regardless of group type (admin can select any)
  const capacityOptions = getAllCapacityOptions();
  
  // Debug: Log available options (remove in production if needed)
  useEffect(() => {
    if (isOpen && groupType && groupType !== 'OTHER') {
      console.log('Available capacity options:', capacityOptions.map(o => `${o.value} (${o.label})`));
    }
  }, [isOpen, groupType, capacityOptions]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{room ? "Edit Room" : "Create New Room"}</DialogTitle>
          <DialogDescription>
            {room ? "Update room information and capacity configurations." : "Add a new room or location to the system."}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* Basic Info */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Room Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Room 101, Conference Room A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group_type">Group Type *</Label>
              <Select
                value={groupType || ""}
                onValueChange={(value: RoomGroup) => {
                  setGroupType(value);
                  if (value === 'OTHER') {
                    setSelectedCapacities([]);
                  } else {
                    // Reset selections when group type changes
                    setSelectedCapacities([]);
                  }
                }}
              >
                <SelectTrigger id="group_type">
                  <SelectValue placeholder="Select group type" />
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
          </div>

          {/* Capacity Selection */}
          {groupType && groupType !== 'OTHER' && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Select Capacities</Label>
              <p className="text-sm text-muted-foreground">Select one or more capacity options for this room. All available options are shown below.</p>
              {capacityOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No capacity options available.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {capacityOptions.map((option, idx) => {
                    const uniqueKey = `${option.value}-${option.label}`;
                    const isSelected = isCapacitySelected(option);
                    return (
                      <div
                        key={idx}
                        className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                        onClick={() => handleToggleCapacity(option)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleCapacity(option)}
                          id={uniqueKey}
                        />
                        <Label
                          htmlFor={uniqueKey}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <span className="flex items-center gap-1">
                            {option.display}
                            <span className="sr-only">{option.label}</span>
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedCapacities.length === 0 && (
                <p className="text-sm text-muted-foreground">Please select at least one capacity option.</p>
              )}
              {selectedCapacities.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedCapacities.map(c => c.capacity_label).join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Cleaning Types & Time Limits */}
          {groupType && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Cleaning Types & Time Limits</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddCleaningType}
                  disabled={
                    availableCleaningTypes[groupType].length === cleaningTypes.length
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Cleaning Type
                </Button>
              </div>

              {cleaningTypes.length === 0 ? (
                <div className="text-center py-8 border border-dashed rounded-lg">
                  <p className="text-sm text-muted-foreground mb-4">
                    No cleaning types configured yet. Click "Add Cleaning Type" to get started.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCleaningType}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Cleaning Type
                  </Button>
                </div>
              ) : (
                <>
                  {cleaningTypes.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-muted-foreground">
                        Configured: {cleaningTypes.map(ct => `${cleaningTypeLabels[ct.type]} (${ct.time_limit} min)`).join(", ")}
                      </p>
                    </div>
                  )}
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    {cleaningTypes.map((ct, ctIndex) => (
                      <div key={ctIndex} className="flex gap-2 items-end">
                        <div className="flex-1 space-y-2">
                          <Label className="text-sm">Type</Label>
                          <Select
                            value={ct.type}
                            onValueChange={(value: CleaningType) =>
                              handleUpdateCleaningType(ctIndex, { type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCleaningTypes[groupType].map(type => (
                                <SelectItem 
                                  key={type} 
                                  value={type}
                                  disabled={cleaningTypes.some((ct, i) => i !== ctIndex && ct.type === type)}
                                >
                                  {cleaningTypeLabels[type]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 space-y-2">
                          <Label className="text-sm">Time Limit (minutes)</Label>
                          <Input
                            type="number"
                            min="1"
                            value={ct.time_limit}
                            onChange={(e) =>
                              handleUpdateCleaningType(ctIndex, {
                                time_limit: parseInt(e.target.value, 10) || 0
                              })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCleaningType(ctIndex)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {cleaningTypes.length < availableCleaningTypes[groupType].length && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddCleaningType}
                        className="w-full mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Another Cleaning Type
                      </Button>
                    )}
                  </CardContent>
                </Card>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : room ? "Save Changes" : "Create Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

