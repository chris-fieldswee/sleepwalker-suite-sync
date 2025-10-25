// src/pages/Reception.tsx
// ... imports remain the same

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
    fetchWorkLogs // Keep if needed directly here, otherwise remove
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
    // *** Destructure new handlers and states ***
    handleUpdateTask,
    isUpdatingTask,
    handleDeleteTask,
    isDeletingTask,
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
          {/* Header remains the same */}
            <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center gap-2">
              <SidebarTrigger />
              <h2 className="text-lg font-semibold">Reception Management</h2>
            </div>


          <div className="container mx-auto p-4 md:p-6"> {/* Adjusted padding */}
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
                    // *** Pass new props ***
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                    isUpdatingTask={isUpdatingTask}
                    isDeletingTask={isDeletingTask}
                  />
                }
              />
              <Route path="archive" element={<Archive />} />
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
