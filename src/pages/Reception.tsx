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
// *** Import AddTaskDialog ***
import { AddTaskDialog } from "@/components/reception/AddTaskDialog";

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
    fetchWorkLogs // Keep if needed elsewhere, not directly for AddTaskDialog in Dashboard
  } = useReceptionData();

  const {
    handleAddTask,
    isSubmittingTask,
    handleSaveWorkLog, // Keep if needed elsewhere
    isSavingLog, // Keep if needed elsewhere
    initialNewTaskState
  } = useReceptionActions(availableRooms, dataActions.refresh, dataActions.refresh);

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
              {/* *** Pass AddTaskDialog props to Dashboard *** */}
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
              <Route path="issues" element={<Issues />} />
            </Routes>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
