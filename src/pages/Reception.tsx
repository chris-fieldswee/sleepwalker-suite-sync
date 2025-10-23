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
import { TaskFilters } from '@/components/reception/TaskFilters'; // Assuming this component is already suitable
import { AddTaskDialog } from '@/components/reception/AddTaskDialog';
import { WorkLogDialog } from '@/components/reception/WorkLogDialog';
import { TaskTableRow } from '@/components/reception/TaskTableRow'; // Assuming this component is already suitable

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
  } = useReceptionActions(availableRooms, filters.date, dataActions.refresh, dataActions.refresh); // Pass refresh as callback

  // Render Add Task Dialog Trigger/Content
  const addTaskDialog = (
    <AddTaskDialog
      availableRooms={availableRooms}
      allStaff={allStaff}
      initialState={initialNewTaskState}
      onSubmit={handleAddTask}
      isSubmitting={isSubmittingTask}
      // Pass a custom trigger or use the default one inside AddTaskDialog
    />
  );

  // Render Work Log Dialog Trigger/Content
  const workLogDialog = (
     <WorkLogDialog
        filterDate={filters.date}
        workLogs={workLogs}
        allStaff={allStaff}
        onSave={handleSaveWorkLog}
        isSaving={isSavingLog}
        // Pass a custom trigger or use the default one inside WorkLogDialog
     />
  );

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
            <CardTitle>Tasks for {new Date(filters.date + 'T00:00:00Z').toLocaleDateString()}</CardTitle> {/* Ensure correct date parsing */}
          </CardHeader>
          <CardContent className="p-0">
            {loading && !refreshing ? ( // Show loading indicator only on initial load or filter change
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                 <span className="ml-2">Loading tasks...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-lg font-medium text-muted-foreground">No tasks found</p>
                <p className="text-sm text-muted-foreground">Try adjusting filters or add a new task.</p>
                {/* Render the Add Task Dialog trigger directly here */}
                 <AddTaskDialog
                    availableRooms={availableRooms}
                    allStaff={allStaff}
                    initialState={initialNewTaskState}
                    onSubmit={handleAddTask}
                    isSubmitting={isSubmittingTask}
                    triggerButton={<Button size="sm" className="mt-4"><Plus className="mr-2 h-4 w-4" /> Add Task</Button>}
                 />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
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
