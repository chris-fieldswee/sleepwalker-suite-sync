import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ImportAvailabilityDialogProps {
  onImportComplete?: () => void;
}

export const ImportAvailabilityDialog: React.FC<ImportAvailabilityDialogProps> = ({ onImportComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [csvData, setCsvData] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvData(content);
    };
    reader.readAsText(file);
  };

  const parseCsvData = (csvContent: string) => {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(/[\t,]/); // Support both tab and comma separation
    
    // Expected headers: Data, Pracownik, Stanowisko, Lokalizacja, Start, Koniec, Suma Godzin
    const dataIndex = headers.findIndex(h => h.toLowerCase().includes('data'));
    const nameIndex = headers.findIndex(h => h.toLowerCase().includes('pracownik'));
    const positionIndex = headers.findIndex(h => h.toLowerCase().includes('stanowisko'));
    const locationIndex = headers.findIndex(h => h.toLowerCase().includes('lokalizacja'));
    const startIndex = headers.findIndex(h => h.toLowerCase().includes('start'));
    const endIndex = headers.findIndex(h => h.toLowerCase().includes('koniec'));
    const hoursIndex = headers.findIndex(h => h.toLowerCase().includes('suma godzin'));

    if (dataIndex === -1 || nameIndex === -1 || hoursIndex === -1) {
      throw new Error('Invalid CSV format. Expected columns: Data, Pracownik, Suma Godzin');
    }

    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[\t,]/); // Support both tab and comma separation
      if (values.length < headers.length) continue;

      const date = values[dataIndex]?.trim();
      const name = values[nameIndex]?.trim();
      const position = values[positionIndex]?.trim() || '';
      const location = values[locationIndex]?.trim() || '';
      const startTime = values[startIndex]?.trim() || '';
      const endTime = values[endIndex]?.trim() || '';
      const totalHours = parseFloat(values[hoursIndex]?.trim() || '0');

      if (date && name && totalHours > 0) {
        records.push({
          date,
          name,
          position,
          location,
          startTime,
          endTime,
          totalHours
        });
      }
    }

    return records;
  };

  const handleImport = async () => {
    if (!csvData.trim()) {
      toast({
        title: "Error",
        description: "Please provide CSV data",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const records = parseCsvData(csvData);
      
      // Get all users to match names
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, first_name, last_name')
        .eq('active', true);

      if (usersError) throw usersError;

      console.log('Available users:', users);
      console.log('Parsed CSV records:', records);

      // Create a map of names to user IDs
      const nameToUserId = new Map<string, string>();
      users?.forEach(user => {
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.name;
        // Add multiple variations for matching
        nameToUserId.set(fullName.toLowerCase(), user.id);
        nameToUserId.set(user.name.toLowerCase(), user.id);
        // Also try with just first name
        if (user.first_name) {
          nameToUserId.set(user.first_name.toLowerCase(), user.id);
        }
        // Try with last name only
        if (user.last_name) {
          nameToUserId.set(user.last_name.toLowerCase(), user.id);
        }
      });

      // Process each record
      const availabilityRecords = [];
      const unmatchedNames = [];

      for (const record of records) {
        const userId = nameToUserId.get(record.name.toLowerCase());
        
        console.log(`Looking for user: "${record.name}" (${record.name.toLowerCase()})`);
        console.log('Available name mappings:', Array.from(nameToUserId.keys()));
        
        if (userId) {
          availabilityRecords.push({
            staff_id: userId,
            date: record.date,
            total_hours: record.totalHours,
            position: record.position,
            location: record.location,
            start_time: record.startTime || null,
            end_time: record.endTime || null,
          });
        } else {
          unmatchedNames.push(record.name);
        }
      }

      if (availabilityRecords.length === 0) {
        throw new Error('No matching users found. Please check the names in your CSV.');
      }

      // Insert availability records using upsert to handle duplicates
      const { error: insertError } = await supabase
        .from('staff_availability')
        .upsert(availabilityRecords, {
          onConflict: 'staff_id,date',
          ignoreDuplicates: false
        });

      if (insertError) throw insertError;

      // Show results
      const message = `Successfully imported ${availabilityRecords.length} availability records.` +
        (unmatchedNames.length > 0 ? ` ${unmatchedNames.length} names could not be matched: ${unmatchedNames.join(', ')}` : '');

      toast({
        title: "Import Successful",
        description: message,
      });

      setIsOpen(false);
      setCsvData('');
      onImportComplete?.();

    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import availability data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import Staff Availability
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Staff Availability</DialogTitle>
          <DialogDescription>
            Upload a CSV file with staff availability data. Expected format: Data, Pracownik, Stanowisko, Lokalizacja, Start, Koniec, Suma Godzin
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="file-upload">Upload CSV File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="csv-data">Or paste CSV data directly</Label>
            <Textarea
              id="csv-data"
              placeholder="Paste your CSV data here..."
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              rows={8}
              className="mt-1 font-mono text-sm"
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Expected CSV format:</p>
              <p className="mt-1">Data	Pracownik	Stanowisko	Lokalizacja	Start	Koniec	Suma Godzin</p>
              <p className="mt-1">2025-10-27	Ewelina Szczudlek	Recepcja I zm.	Recepcja	6:00	14:30	8.5</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting || !csvData.trim()}>
            {isImporting ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
