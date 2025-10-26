// src/pages/Reception.tsx
import { Routes, Route } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ReceptionSidebar } from "@/components/reception/ReceptionSidebar";
import { useReceptionData } from "@/hooks/useReceptionData";
import { useReceptionActions } from "@/hooks/useReceptionActions";

// Import view components
import Dashboard from "./reception/Dashboard";
import Tasks from "./reception/Tasks";
import Archive from "./reception/Archive";
import Issues from "./reception/Issues";

export default function Reception() {
  const { signOut } = useAuth();

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
    fetchWorkLogs // Keep fetchWorkLogs if needed elsewhere, Archive doesn't directly use it
  } = useReceptionData();

  const {
    handleAddTask,
    isSubmittingTask,
    handleSaveWorkLog,
    isSavingLog,
    initialNewTaskState,
    handleReportNewIssue,
    isSubmittingNewIssue,
    handleUpdateIssue,
    isUpdatingIssue,
    handleUpdateTask, // Needed for Tasks and Archive
    isUpdatingTask,   // Needed for Tasks and Archive
    handleDeleteTask, // Needed for Tasks and Archive
    isDeletingTask,   // Needed for Tasks and Archive
  } = useReceptionActions(
      availableRooms,
      dataActions.refresh, // onTaskAdded
      dataActions.refresh, // onWorkLogSaved
      dataActions.refresh, // onIssueReported
      dataActions.refresh, // onIssueUpdated
      dataActions.refresh, // onTaskUpdated
      dataActions.refresh  // onTaskDeleted
   );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ReceptionSidebar onSignOut={signOut} />

        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-2">
            <SidebarTrigger />
            <h2 className="text-lg font-semibold">Reception Management</h2>
          </div>

          <div className="container mx-auto p-4 md:p-6">
            <Routes>
              <Route
                index
                element={
                  <Dashboard
                    stats={stats}
                    availableRooms={availableRooms}
                    allStaff={allStaff}
                    initialNewTaskState={initialNewTaskState}
                    handleAddTask={handleAddTask}
                    isSubmittingTask={isSubmittingTask}
                    handleReportNewIssue={handleReportNewIssue}
                    isSubmittingNewIssue={isSubmittingNewIssue}
                  />
                }
              />
              <Route
                path="tasks"
                element={
                  <Tasks
                    tasks={tasks}
                    allStaff={allStaff}
                    availableRooms={availableRooms}
                    workLogs={workLogs}
                    loading={loading}
                    refreshing={refreshing}
                    filters={filters}
                    onDateChange={filterSetters.setDate}
                    onStatusChange={filterSetters.setStatus}
                    onStaffChange={filterSetters.setStaffId}
                    onRoomGroupChange={filterSetters.setRoomGroup}
                    onRoomChange={filterSetters.setRoomId}
                    onClearFilters={dataActions.clearFilters}
                    onRefresh={dataActions.refresh}
                    onAddTask={handleAddTask}
                    onSaveWorkLog={handleSaveWorkLog}
                    initialNewTaskState={initialNewTaskState}
                    isSubmittingTask={isSubmittingTask}
                    isSavingLog={isSavingLog}
                    onUpdateTask={handleUpdateTask} // Pass update handler
                    onDeleteTask={handleDeleteTask} // Pass delete handler
                    isUpdatingTask={isUpdatingTask} // Pass updating state
                    isDeletingTask={isDeletingTask} // Pass deleting state
                  />
                }
              />
              {/* *** MODIFICATION START: Pass props to Archive route *** */}
              <Route
                path="archive"
                element={
                  <Archive
                    allStaff={allStaff}
                    availableRooms={availableRooms}
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                    isUpdatingTask={isUpdatingTask}
                    isDeletingTask={isDeletingTask}
                  />
                }
              />
              {/* *** MODIFICATION END *** */}
              <Route
                path="issues"
                element={
                  <Issues
                    availableRooms={availableRooms}
                    handleReportNewIssue={handleReportNewIssue}
                    isSubmittingNewIssue={isSubmittingNewIssue}
                    allStaff={allStaff}
                    handleUpdateIssue={handleUpdateIssue}
                    isUpdatingIssue={isUpdatingIssue}
                  />
                }
              />
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
