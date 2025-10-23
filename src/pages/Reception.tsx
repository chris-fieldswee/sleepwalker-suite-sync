// src/pages/Reception.tsx
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Plus, ListChecks, Archive, ShieldAlert } from "lucide-react"; // Import icons
import { Link, useLocation } from "react-router-dom"; // Import routing hooks

// Import Sidebar components
import {
    SidebarProvider,
    Sidebar,
    SidebarInset,
    SidebarHeader,
    // SidebarTrigger, // Optional: for collapsing sidebar
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton
} from "@/components/ui/sidebar";

// Import Refactored Hooks & Components
import { useReceptionData } from '@/hooks/useReceptionData';
import { useReceptionActions } from '@/hooks/useReceptionActions';
import { ReceptionHeader } from '@/components/reception/ReceptionHeader';
import { StatsCards } from '@/components/reception/StatsCards';
import { TaskFilters } from '@/components/reception/TaskFilters';
import { AddTaskDialog } from '@/components/reception/AddTaskDialog';
import { WorkLogDialog } from '@/components/reception/WorkLogDialog';
import { TaskTableRow } from '@/components/reception/TaskTableRow';
import { cn } from "@/lib/utils"; // Import cn utility

// Helper function to get today's date string
const getTodayDateString = () => new Date().toISOString().split("T")[0];

// Function to get locale-specific date string for display (outside component)
const getDisplayDate = (dateString: string | null) => {
    if (!dateString) return "Upcoming";
    try {
        return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' // Displaying UTC date
        });
    } catch (e) {
        console.error("Error formatting date string:", dateString, e);
        return dateString; // Fallback
    }
};

export default function Reception() {
  const { signOut } = useAuth();
  const location = useLocation();

  const getActiveView = () => {
      if (location.pathname.endsWith('/archived')) return 'archived';
      if (location.pathname.endsWith('/damages')) return 'damages';
      return 'tasks'; // Default view
  };
  const activeView = getActiveView();

  // TODO: Update useReceptionData to accept activeView and modify fetchTasks
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
    fetchWorkLogs
  } = useReceptionData(); // Pass activeView here when hook is updated

  const {
    handleAddTask,
    isSubmittingTask,
    handleSaveWorkLog,
    isSavingLog,
    initialNewTaskState
  } = useReceptionActions(availableRooms, dataActions.refresh, dataActions.refresh);

  // Define Dialogs
  const addTaskDialog = (
    <AddTaskDialog availableRooms={availableRooms} allStaff={allStaff} initialState={initialNewTaskState} onSubmit={handleAddTask} isSubmitting={isSubmittingTask} />
  );
  const workLogDialog = (
     <WorkLogDialog filterDate={filters.date || getTodayDateString()} workLogs={workLogs} allStaff={allStaff} onSave={handleSaveWorkLog} isSaving={isSavingLog} />
  );

  // Placeholder - adjust based on activeView and hook modifications
  const filteredTasksForView = tasks;
  const showDateFilter = activeView === 'tasks';

  return (
    <SidebarProvider>
        <div className="flex min-h-screen bg-muted/30"> {/* Changed background */}
             <Sidebar>
                <SidebarHeader>
                    <h2 className="text-lg font-semibold px-2">Reception</h2>
                </SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild className={cn(activeView === 'tasks' && 'bg-sidebar-accent text-sidebar-accent-foreground')} tooltip="Current & Upcoming Tasks">
                            <Link to="/reception/tasks"><ListChecks /> <span>Tasks</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild className={cn(activeView === 'archived' && 'bg-sidebar-accent text-sidebar-accent-foreground')} tooltip="Completed Tasks">
                             <Link to="/reception/archived"><Archive /> <span>Archived Tasks</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                         <SidebarMenuButton asChild className={cn(activeView === 'damages' && 'bg-sidebar-accent text-sidebar-accent-foreground')} tooltip="Reported Issues">
                            <Link to="/reception/damages"><ShieldAlert /> <span>Damages</span></Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
             </Sidebar>

            <SidebarInset className="flex flex-col flex-1"> {/* Use SidebarInset, remove bg-background if inset style applies bg */}
                <ReceptionHeader
                    onRefresh={dataActions.refresh}
                    onSignOut={signOut}
                    refreshing={refreshing}
                    loading={loading}
                    addTaskTrigger={addTaskDialog}
                    workLogTrigger={workLogDialog}
                />

                <main className="container mx-auto p-4 flex-1">
                    {activeView === 'tasks' && <StatsCards stats={stats} />}

                    <Card className="mb-4">
                      <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
                      <CardContent>
                        <TaskFilters
                          date={filters.date} status={filters.status} staffId={filters.staffId} roomGroup={filters.roomGroup} staff={allStaff}
                          onDateChange={filterSetters.setDate} onStatusChange={filterSetters.setStatus} onStaffChange={filterSetters.setStaffId} onRoomGroupChange={filterSetters.setRoomGroup}
                          onClearFilters={dataActions.clearFilters}
                          // Pass showDateFilter or similar prop if needed
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                         <CardTitle>
                            {activeView === 'tasks' && `Tasks for ${getDisplayDate(filters.date)}`}
                            {activeView === 'archived' && `Archived Tasks`}
                            {activeView === 'damages' && `Reported Damages`}
                         </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {/* *** FIX: Corrected Conditional Rendering Logic *** */}
                        {loading && !refreshing ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                <span className="ml-2">Loading tasks...</span>
                            </div>
                         ) : filteredTasksForView.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <p className="text-lg font-medium text-muted-foreground">
                                    {activeView === 'tasks' && (filters.date ? `No tasks found for ${getDisplayDate(filters.date)}` : "No upcoming tasks found")}
                                    {activeView === 'archived' && "No archived tasks found matching filters"}
                                    {activeView === 'damages' && "No damages found matching filters"}
                                </p>
                                <p className="text-sm text-muted-foreground">Try adjusting filters or add a new task.</p>
                                {activeView === 'tasks' && (
                                    <AddTaskDialog
                                        availableRooms={availableRooms} allStaff={allStaff}
                                        initialState={{ ...initialNewTaskState, date: filters.date || getTodayDateString() }}
                                        onSubmit={handleAddTask} isSubmitting={isSubmittingTask}
                                        triggerButton={<Button size="sm" className="mt-4"><Plus className="mr-2 h-4 w-4" /> Add Task {filters.date ? `for ${getDisplayDate(filters.date)}` : ''}</Button>}
                                    />
                                )}
                            </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                {/* TODO: Adjust Table Headers based on activeView if needed */}
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
                                {filteredTasksForView.map((task) => (
                                  // TODO: TaskTableRow might need props adjusted based on view
                                  <TaskTableRow key={task.id} task={task} staff={allStaff} />
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                </main>
                 <footer className="h-10 flex-shrink-0"></footer> {/* Ensure footer doesn't grow */}
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
