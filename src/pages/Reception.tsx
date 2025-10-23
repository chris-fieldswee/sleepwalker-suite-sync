// src/pages/Reception.tsx
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Plus } from "lucide-react";

// Import Refactored Hooks & Components
import { useReceptionData } from '@/hooks/useReceptionData';
import { useReceptionActions } from '@/hooks/useReceptionActions';
import { ReceptionHeader } from '@/components/reception/ReceptionHeader';
import { StatsCards } from '@/components/reception/StatsCards';
import { TaskFilters } from '@/components/reception/TaskFilters';
import { AddTaskDialog } from '@/components/reception/AddTaskDialog';
import { WorkLogDialog } from '@/components/reception/WorkLogDialog';
import { TaskTableRow } from '@/components/reception/TaskTableRow';

// Helper function to get today's date string
const getTodayDateString = () => new Date().toISOString().split("T")[0];

export default function Reception() {
  const { signOut } = useAuth();

  // Use the custom hooks to manage data and actions
  const {
    tasks,
    allStaff,
    availableRooms,
    workLogs,
    loading,
    refreshing,
    filters,
    filterSetters,
    actions: dataActions,
    stats,
    fetchWorkLogs // Expose fetchWorkLogs if WorkLogDialog needs to trigger a refetch after save
  } = useReceptionData();

  const {
    handleAddTask,
    isSubmittingTask,
    handleSaveWorkLog,
    isSavingLog,
    initialNewTaskState
  } = useReceptionActions(availableRooms, dataActions.refresh, dataActions.refresh); // Pass refresh as callback

  // Render Add Task Dialog Trigger/Content
  const addTaskDialog = (
    <AddTaskDialog
      availableRooms={availableRooms}
      allStaff={allStaff}
      initialState={initialNewTaskState} // Pass the initial state which now includes today's date
      onSubmit={handleAddTask} // handleAddTask now expects the full NewTaskState including the date
      isSubmitting={isSubmittingTask}
      // Uses default trigger button inside AddTaskDialog
    />
  );

  // Render Work Log Dialog Trigger/Content
  const workLogDialog = (
     <WorkLogDialog
        filterDate={filters.date || getTodayDateString()} // Pass today's date if filterDate is null
        workLogs={workLogs}
        allStaff={allStaff}
        onSave={handleSaveWorkLog}
        isSaving={isSavingLog}
        // Uses default trigger button inside WorkLogDialog
     />
  );

  // Function to get locale-specific date string for display
  const getDisplayDate = (dateString: string | null) => {
    if (!dateString) return "Upcoming"; // Display "Upcoming" if date is null
    try {
        // Add T00:00:00Z to ensure date is parsed as UTC midnight consistently
        // Adjust options as needed for desired format
        return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' // Display date portion
        });
    } catch (e) {
        console.error("Error formatting date string:", dateString, e);
        return dateString; // Fallback
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <ReceptionHeader
        onRefresh={dataActions.refresh}
        onSignOut={signOut}
        refreshing={refreshing}
        loading={loading}
        addTaskTrigger={addTaskDialog} // Pass AddTaskDialog instance as the trigger prop
        workLogTrigger={workLogDialog}   // Pass WorkLogDialog instance as the trigger prop
      />

      <main className="container mx-auto p-4">
        {/* Statistics Cards */}
        <StatsCards stats={stats} />

        {/* Filters */}
        <Card className="mb-4">
          <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
          <CardContent>
            <TaskFilters
              date={filters.date}
              status={filters.status}
              staffId={filters.staffId}
              roomGroup={filters.roomGroup}
              staff={allStaff}
              onDateChange={filterSetters.setDate}
              onStatusChange={filterSetters.setStatus}
              onStaffChange={filterSetters.setStaffId}
              onRoomGroupChange={filterSetters.setRoomGroup}
              onClearFilters={dataActions.clearFilters}
            />
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card>
          <CardHeader>
             {/* Use helper function for display */}
            <CardTitle>Tasks for {getDisplayDate(filters.date)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading && !refreshing ? ( // Show loading indicator only on initial load or filter change
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                 <span className="ml-2">Loading tasks...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                {/* Update empty state text */}
                <p className="text-lg font-medium text-muted-foreground">
                  {filters.date ? `No tasks found for ${getDisplayDate(filters.date)}` : "No upcoming tasks found"}
                </p>
                <p className="text-sm text-muted-foreground">Try adjusting filters or add a new task.</p>
                 {/* Render the Add Task Dialog trigger directly here */}
                 <AddTaskDialog
                    availableRooms={availableRooms}
                    allStaff={allStaff}
                    // Default date to today or filtered date
                    initialState={{ ...initialNewTaskState, date: filters.date || getTodayDateString() }}
                    onSubmit={handleAddTask}
                    isSubmitting={isSubmittingTask}
                    // Update button text when no date filter
                    triggerButton={<Button size="sm" className="mt-4"><Plus className="mr-2 h-4 w-4" /> Add Task {filters.date ? `for ${getDisplayDate(filters.date)}` : ''}</Button>}
                 />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {/* Table Headers */}
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Room</TableHead>
                      <TableHead className="font-semibold">Staff</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold text-center">Guests</TableHead>
                      <TableHead className="font-semibold text-center">Limit (min)</TableHead>
                      <TableHead className="font-semibold text-center">Actual (min)</TableHead>
                      <TableHead className="font-semibold text-center">Diff (min)</TableHead>
                      <TableHead className="font-semibold text-center">Issue</TableHead>
                      <TableHead className="font-semibold min-w-[200px]">Notes</TableHead>
                      <TableHead className="font-semibold text-center">Working Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      // Ensure TaskTableRow receives all necessary props
                      <TaskTableRow key={task.id} task={task} staff={allStaff} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
       {/* Footer Padding */}
       <footer className="h-10"></footer>
    </div>
  );
}
