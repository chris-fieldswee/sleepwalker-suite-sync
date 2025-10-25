// src/pages/reception/Tasks.tsx
// Add necessary imports
import { useState } from "react"; // Add useState
import { TaskDetailDialog } from "@/components/reception/TaskDetailDialog"; // Import the new dialog
// ... other imports remain the same

// ... Interface/Type definitions remain the same

interface TasksProps {
  // ... existing props
  onUpdateTask: (taskId: string, updates: any) => Promise<boolean>; // Add update handler prop
  onDeleteTask: (taskId: string) => Promise<boolean>; // Add delete handler prop
  isUpdatingTask: boolean; // Add loading state for update
  isDeletingTask: boolean; // Add loading state for delete
}

export default function Tasks({
  tasks,
  allStaff,
  availableRooms,
  workLogs,
  loading,
  refreshing,
  filters,
  onDateChange,
  onStatusChange,
  onStaffChange,
  onRoomGroupChange,
  onRoomChange,
  onClearFilters,
  onRefresh,
  onAddTask,
  onSaveWorkLog,
  initialNewTaskState,
  isSubmittingTask,
  isSavingLog,
  // *** Destructure new props ***
  onUpdateTask,
  onDeleteTask,
  isUpdatingTask,
  isDeletingTask,
}: TasksProps) {

  // *** Add State for Detail Dialog ***
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const handleViewDetails = (task: Task) => {
    setSelectedTaskForDetail(task);
    setIsDetailDialogOpen(true);
  };

  const handleDelete = async (taskId: string) => {
      const success = await onDeleteTask(taskId);
      // Optional: Close detail dialog if the deleted task was open
      if (success && selectedTaskForDetail?.id === taskId) {
          setIsDetailDialogOpen(false);
          setSelectedTaskForDetail(null);
      }
  };

  // Split tasks and rooms (remains the same)
  const regularTasks = tasks.filter(task => task.room.group_type !== 'OTHER');
  const otherTasks = tasks.filter(task => task.room.group_type === 'OTHER');
  const regularRooms = availableRooms.filter(room => room.group_type !== 'OTHER');
  const otherRooms = availableRooms.filter(room => room.group_type === 'OTHER');
  const regularRoomGroups: RoomGroupOption[] = allRoomGroups.filter(rg => rg.value !== 'OTHER');
  const otherRoomGroups: RoomGroupOption[] = allRoomGroups.filter(rg => rg.value === 'all' || rg.value === 'OTHER');

  const renderTaskTable = (taskList: Task[], emptyMessage: string) => (
    loading && !refreshing ? (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-2">Loading tasks...</span>
      </div>
    ) : taskList.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground">Try adjusting filters or add a new task.</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 sticky top-0 z-10"> {/* Make header sticky */}
              {/* *** Adjust TableHead for new layout *** */}
              <TableHead className="font-semibold w-[100px]">Status</TableHead>
              <TableHead className="font-semibold w-[100px]">Room</TableHead>
              <TableHead className="font-semibold w-[150px]">Staff</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Type</TableHead>
              <TableHead className="font-semibold text-center w-[80px]">Guests</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Limit</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Actual</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Issue</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Notes</TableHead>
              <TableHead className="font-semibold text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map((task) => (
              <TaskTableRow
                  key={task.id}
                  task={task}
                  staff={allStaff}
                  // *** Pass new handlers ***
                  onViewDetails={handleViewDetails}
                  onDeleteTask={handleDelete} // Pass wrapped handler
                  isDeleting={isDeletingTask} // Pass loading state
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  return (
    <div className="space-y-4">
      {/* Header section remains the same */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tasks</h1>
            <p className="text-muted-foreground mt-1">Manage active housekeeping tasks</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing || loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <WorkLogDialog
              filterDate={filters.date || getTodayDateString()}
              workLogs={workLogs}
              allStaff={allStaff}
              onSave={onSaveWorkLog}
              isSaving={isSavingLog}
            />
            <AddTaskDialog
              availableRooms={availableRooms}
              allStaff={allStaff}
              initialState={initialNewTaskState}
              onSubmit={onAddTask}
              isSubmitting={isSubmittingTask}
            />
          </div>
        </div>

      <Tabs defaultValue="regular" className="w-full">
        {/* TabsList remains the same */}
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regular">Hotel Rooms ({regularTasks.length})</TabsTrigger>
          <TabsTrigger value="other">Other Locations ({otherTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="regular" className="space-y-4">
          {/* Filters Card remains the same, passing regularRoomGroups */}
           <Card>
             <CardHeader className="py-4">
               <CardTitle className="text-lg">Filters</CardTitle>
             </CardHeader>
             <CardContent className="pt-0 pb-4">
               <TaskFilters
                 date={filters.date}
                 status={filters.status}
                 staffId={filters.staffId}
                 roomGroup={filters.roomGroup}
                 roomId={filters.roomId}
                 staff={allStaff}
                 availableRooms={regularRooms}
                 roomGroups={regularRoomGroups}
                 onDateChange={onDateChange}
                 onStatusChange={onStatusChange}
                 onStaffChange={onStaffChange}
                 onRoomGroupChange={onRoomGroupChange}
                 onRoomChange={onRoomChange}
                 onClearFilters={onClearFilters}
                 showRoomGroupFilter={true}
               />
             </CardContent>
           </Card>

          <Card>
            {/* CardHeader remains the same */}
            <CardHeader>
              <CardTitle>Hotel Room Tasks for {getDisplayDate(filters.date)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(regularTasks, filters.date ? `No hotel room tasks found for ${getDisplayDate(filters.date)}` : "No upcoming hotel room tasks found")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          {/* Filters Card remains the same, passing otherRoomGroups */}
            <Card>
             <CardHeader className="py-4">
               <CardTitle className="text-lg">Filters</CardTitle>
             </CardHeader>
             <CardContent className="pt-0 pb-4">
               <TaskFilters
                 date={filters.date}
                 status={filters.status}
                 staffId={filters.staffId}
                 roomGroup="OTHER"
                 roomId={filters.roomId}
                 staff={allStaff}
                 availableRooms={otherRooms}
                 roomGroups={otherRoomGroups}
                 onDateChange={onDateChange}
                 onStatusChange={onStatusChange}
                 onStaffChange={onStaffChange}
                 onRoomGroupChange={onRoomGroupChange}
                 onRoomChange={onRoomChange}
                 onClearFilters={onClearFilters}
                 showRoomGroupFilter={false}
               />
             </CardContent>
           </Card>
          <Card>
            {/* CardHeader remains the same */}
             <CardHeader>
               <CardTitle>Other Location Tasks for {getDisplayDate(filters.date)}</CardTitle>
             </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(otherTasks, filters.date ? `No other location tasks found for ${getDisplayDate(filters.date)}` : "No upcoming other location tasks found")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

       {/* *** Render the Detail Dialog *** */}
       <TaskDetailDialog
            task={selectedTaskForDetail}
            allStaff={allStaff}
            availableRooms={availableRooms}
            isOpen={isDetailDialogOpen}
            onOpenChange={setIsDetailDialogOpen}
            onUpdate={onUpdateTask}
            isUpdating={isUpdatingTask}
       />
    </div>
  );
}

// *** Make sure these types are exported or defined correctly ***
// (These might already be in useReceptionData.ts)
export type { Task, Staff, Room, WorkLog };
const allRoomGroups: RoomGroupOption[] = [
    { value: 'all', label: 'All Groups' }, { value: 'P1', label: 'P1' }, { value: 'P2', label: 'P2' },
    { value: 'A1S', label: 'A1S' }, { value: 'A2S', label: 'A2S' }, { value: 'OTHER', label: 'Other' },
];
