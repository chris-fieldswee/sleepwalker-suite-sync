// src/pages/Reception.tsx
import { Routes, Route } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ReceptionSidebar } from "@/components/reception/ReceptionSidebar";
import { useReceptionData } from '@/hooks/useReceptionData';
import { useReceptionActions } from '@/hooks/useReceptionActions';

// Import page components
import Dashboard from "./reception/Dashboard";
import Tasks from "./reception/Tasks";
import Archive from "./reception/Archive";
import Issues from "./reception/Issues";
// Import AddTaskDialog - already imported

export default function Reception() {
  const { signOut } = useAuth();

  const {
    tasks,
    allStaff,
    availableRooms, // Needed for the new dialog
    workLogs,
    loading,
    refreshing,
    filters,
    filterSetters,
    actions: dataActions,
    stats,
    fetchWorkLogs
  } = useReceptionData();

  const {
    handleAddTask,
    isSubmittingTask,
    handleSaveWorkLog,
    isSavingLog,
    initialNewTaskState,
    // *** Get new handler and loading state ***
    handleReportNewIssue,
    isSubmittingNewIssue
      // *** Pass refresh action as the callback for reporting issue ***
  } = useReceptionActions(availableRooms, dataActions.refresh, dataActions.refresh, dataActions.refresh);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <ReceptionSidebar onSignOut={signOut} />

        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-2">
            <SidebarTrigger />
            <h2 className="text-lg font-semibold">Reception Management</h2>
          </div>

          <div className="container mx-auto p-6">
            <Routes>
              {/* Pass issue reporting props to Dashboard */}
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
                    // *** Pass new props ***
                    handleReportNewIssue={handleReportNewIssue}
                    isSubmittingNewIssue={isSubmittingNewIssue}
                  />
                }
              />
              <Route
                path="tasks"
                element={
                  <Tasks
                    // ... (existing props)
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
                    onClearFilters={dataActions.clearFilters}
                    onRefresh={dataActions.refresh}
                    onAddTask={handleAddTask}
                    onSaveWorkLog={handleSaveWorkLog}
                    initialNewTaskState={initialNewTaskState}
                    isSubmittingTask={isSubmittingTask}
                    isSavingLog={isSavingLog}
                  />
                }
              />
              <Route path="archive" element={<Archive />} />
               {/* Pass issue reporting props to Issues */}
              <Route
                path="issues"
                element={
                  <Issues
                    // *** Pass new props (assuming Issues needs them directly) ***
                    // *** Alternatively, fetch availableRooms inside Issues.tsx if needed ***
                    availableRooms={availableRooms}
                    handleReportNewIssue={handleReportNewIssue}
                    isSubmittingNewIssue={isSubmittingNewIssue}
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
