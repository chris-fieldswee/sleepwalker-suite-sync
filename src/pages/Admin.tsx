import { Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useReceptionData } from "@/hooks/useReceptionData";
import { useReceptionActions } from "@/hooks/useReceptionActions";
import { useToast } from "@/hooks/use-toast";

// Import reception pages
import Dashboard from "./reception/Dashboard";
import Tasks from "./reception/Tasks";
import Archive from "./reception/Archive";
import Issues from "./reception/Issues";

// Import admin pages
import Users from "./admin/Users";
import Rooms from "./admin/Rooms";

export default function Admin() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  
  // Use the same data hooks as reception
  const receptionData = useReceptionData();
  const receptionActions = useReceptionActions(
    receptionData.allStaff,
    receptionData.availableRooms,
    receptionData.refresh,
    toast
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar onSignOut={signOut} />

        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-2">
            <SidebarTrigger />
            <h2 className="text-lg font-semibold">Admin Management</h2>
          </div>

          <div className="container mx-auto p-4 md:p-6">
            <Routes>
              {/* Reception routes - same as reception dashboard */}
              <Route
                path="/"
                element={
                  <Dashboard
                    stats={receptionData.stats}
                    availableRooms={receptionData.availableRooms}
                    allStaff={receptionData.allStaff}
                    initialNewTaskState={receptionActions.initialNewTaskState}
                    handleAddTask={receptionActions.handleAddTask}
                    isSubmittingTask={receptionActions.isSubmittingTask}
                    handleReportNewIssue={receptionActions.handleReportNewIssue}
                    isSubmittingNewIssue={receptionActions.isSubmittingNewIssue}
                    basePath="/admin"
                  />
                }
              />
              <Route
                path="tasks"
                element={
                  <Tasks
                    tasks={receptionData.tasks}
                    allStaff={receptionData.allStaff}
                    availableRooms={receptionData.availableRooms}
                    workLogs={receptionData.workLogs}
                    loading={receptionData.loading}
                    refreshing={receptionData.refreshing}
                    filters={receptionData.filters}
                    onDateChange={receptionData.filterSetters.setDate}
                    onStatusChange={receptionData.filterSetters.setStatus}
                    onStaffChange={receptionData.filterSetters.setStaffId}
                    onRoomGroupChange={receptionData.filterSetters.setRoomGroup}
                    onRoomChange={receptionData.filterSetters.setRoomId}
                    onClearFilters={receptionData.actions.clearFilters}
                    onRefresh={receptionData.actions.refresh}
                    onAddTask={receptionActions.handleAddTask}
                    onSaveWorkLog={receptionActions.handleSaveWorkLog}
                    initialNewTaskState={receptionActions.initialNewTaskState}
                    isSubmittingTask={receptionActions.isSubmittingTask}
                    isSavingLog={receptionActions.isSavingLog}
                    onUpdateTask={receptionActions.handleUpdateTask}
                    onDeleteTask={receptionActions.handleDeleteTask}
                    isUpdatingTask={receptionActions.isUpdatingTask}
                    isDeletingTask={receptionActions.isDeletingTask}
                  />
                }
              />
              <Route
                path="archive"
                element={
                  <Archive
                    allStaff={receptionData.allStaff}
                    availableRooms={receptionData.availableRooms}
                    onUpdateTask={receptionActions.handleUpdateTask}
                    onDeleteTask={receptionActions.handleDeleteTask}
                    isUpdatingTask={receptionActions.isUpdatingTask}
                    isDeletingTask={receptionActions.isDeletingTask}
                  />
                }
              />
              <Route
                path="issues"
                element={
                  <Issues
                    allStaff={receptionData.allStaff}
                    availableRooms={receptionData.availableRooms}
                    onUpdate={receptionData.actions.refresh}
                  />
                }
              />

              {/* Admin-specific routes */}
              <Route path="users" element={<Users />} />
              <Route path="rooms" element={<Rooms />} />
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
