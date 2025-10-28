import { Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
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
import CreateUser from "./admin/CreateUser";
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
      <div className="flex min-h-screen w-full">
        <AdminSidebar onSignOut={signOut} />
        <SidebarInset className="flex-1">
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
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
              <Route path="users/create" element={<CreateUser />} />
              <Route path="rooms" element={<Rooms />} />
            </Routes>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
