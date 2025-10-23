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
    SidebarTrigger, // Optional: for collapsing sidebar
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

export default function Reception() {
  const { signOut } = useAuth();
  const location = useLocation(); // Get current path

  // Determine active view based on pathname
  const getActiveView = () => {
      if (location.pathname.endsWith('/archived')) return 'archived';
      if (location.pathname.endsWith('/damages')) return 'damages';
      return 'tasks'; // Default view
  };
  const activeView = getActiveView();

  // *** TODO: Modify useReceptionData hook to accept 'activeView' and adjust fetchTasks query ***
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

  // Define Dialogs (triggers will be placed in header)
  const addTaskDialog = (
    <AddTaskDialog availableRooms={availableRooms} allStaff={allStaff} initialState={initialNewTaskState} onSubmit={handleAddTask} isSubmitting={isSubmittingTask} />
  );
  const workLogDialog = (
     <WorkLogDialog filterDate={filters.date || getTodayDateString()} workLogs={workLogs} allStaff={allStaff} onSave={handleSaveWorkLog} isSaving={isSavingLog} />
  );

  const getDisplayDate = (dateString: string | null) => { /* ... unchanged ... */ };

  // Conditional logic based on activeView (will need refinement)
  const filteredTasksForView = tasks; // Placeholder - adjust based on activeView

  // Adjust filters based on view (e.g., hide date for archived/damages?)
  const showDateFilter = activeView === 'tasks'; // Example: only show date for 'tasks' view

  return (
    // Wrap entire page in SidebarProvider
    <SidebarProvider>
        <div className="flex min-h-screen">
             {/* Sidebar Navigation */}
             <Sidebar>
                <SidebarHeader>
                    {/* Optional: Add a title or logo */}
                    <h2 className="text-lg font-semibold px-2">Reception</h2>
                </SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            // Use cn to apply active styles
                            className={cn(activeView === 'tasks' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                            tooltip="Current & Upcoming Tasks"
                        >
                            <Link to="/reception/tasks">
                                <ListChecks /> <span>Tasks</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className={cn(activeView === 'archived' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                            tooltip="Completed Tasks"
                        >
                             <Link to="/reception/archived">
                                <Archive /> <span>Archived Tasks</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                         <SidebarMenuButton
                            asChild
                            className={cn(activeView === 'damages' && 'bg-sidebar-accent text-sidebar-accent-foreground')}
                            tooltip="Reported Issues"
                         >
                            <Link to="/reception/damages">
                                <ShieldAlert /> <span>Damages</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                {/* Optional: SidebarFooter for user info/logout */}
             </Sidebar>

            {/* Main Content Area */}
            <SidebarInset className="flex flex-col flex-1 bg-background"> {/* Use SidebarInset */}
                <ReceptionHeader
                    onRefresh={dataActions.refresh}
                    onSignOut={signOut}
                    refreshing={refreshing}
                    loading={loading}
                    addTaskTrigger={addTaskDialog}
                    workLogTrigger={workLogDialog}
                />

                <main className="container mx-auto p-4 flex-1"> {/* Ensure main content can grow */}
                    {/* Conditionally render stats? */}
                    {activeView === 'tasks' && <StatsCards stats={stats} />}

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
                          // Pass showDateFilter or similar prop if needed
                          // showDateFilter={showDateFilter}
                        />
                      </CardContent>
                    </Card>

                    {/* Tasks Table */}
                    <Card>
                      <CardHeader>
                         <CardTitle>
                            {/* Adjust title based on view */}
                            {activeView === 'tasks' && `Tasks for ${getDisplayDate(filters.date)}`}
                            {activeView === 'archived' && `Archived Tasks`}
                            {activeView === 'damages' && `Reported Damages`}
                         </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {loading && !refreshing ? ( /* ... loading ... */ )
                        : filteredTasksForView.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <p className="text-lg font-medium text-muted-foreground">
                                {/* Adjust empty state message */}
                                {activeView === 'tasks' && (filters.date ? `No tasks found for ${getDisplayDate(filters.date)}` : "No upcoming tasks found")}
                                {activeView === 'archived' && "No archived tasks found matching filters"}
                                {activeView === 'damages' && "No damages found matching filters"}
                            </p>
                            <p className="text-sm text-muted-foreground">Try adjusting filters or add a new task.</p>
                             {activeView === 'tasks' && ( // Only show Add Task button in tasks view for now
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
                                   {/* Conditionally hide/show columns */}
                                  <TableHead className="font-semibold">Staff</TableHead>
                                  <TableHead className="font-semibold">Type</TableHead>
                                  {/* ... other headers */}
                                  <TableHead className="font-semibold min-w-[200px]">Notes</TableHead>
                                  {/* Maybe hide timing columns for archived/damages */}
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
                 {/* Footer Padding */}
                 <footer className="h-10"></footer>
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}

// Function to get locale-specific date string for display (outside component)
const getDisplayDate = (dateString: string | null) => {
    if (!dateString) return "Upcoming";
    try {
        return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
        });
    } catch (e) { return dateString; }
};
