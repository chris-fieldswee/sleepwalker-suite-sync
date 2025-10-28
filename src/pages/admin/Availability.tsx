import React from 'react';
import { StaffAvailabilityManager } from '@/components/admin/StaffAvailabilityManager';
import { ImportAvailabilityDialog } from '@/components/admin/ImportAvailabilityDialog';

const Availability: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff Availability Management</h1>
          <p className="text-muted-foreground">Import and manage staff availability schedules</p>
        </div>
        <ImportAvailabilityDialog onImportComplete={() => window.location.reload()} />
      </div>
      
      <StaffAvailabilityManager />
    </div>
  );
};

export default Availability;
