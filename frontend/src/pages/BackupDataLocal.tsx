import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export default function BackupDataLocalPage() {
  const { toast } = useToast();

  const [destinationDirectory, setDestinationDirectory] = useState('');
  const [fileName, setFileName] = useState('finance.db');
  const [loadingDefault, setLoadingDefault] = useState(true);
  const [savingBackup, setSavingBackup] = useState(false);

  useEffect(() => {
    const loadDefaultPath = async () => {
      try {
        setLoadingDefault(true);
        const response = await api.getDefaultLocalBackupDestination();
        setDestinationDirectory(response.default_directory);
      } catch (error) {
        toast({
          title: 'Could not load default destination',
          description: error instanceof Error ? error.message : 'An unexpected error occurred',
          variant: 'destructive',
        });
      } finally {
        setLoadingDefault(false);
      }
    };

    void loadDefaultPath();
  }, [toast]);

  const handleBackup = async () => {
    if (!destinationDirectory.trim()) {
      toast({
        title: 'Destination required',
        description: 'Please provide a destination directory.',
        variant: 'destructive',
      });
      return;
    }

    if (!fileName.trim()) {
      toast({
        title: 'File name required',
        description: 'Please provide a file name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingBackup(true);
      const result = await api.backupDataLocally({
        destination_directory: destinationDirectory.trim(),
        file_name: fileName.trim(),
      });

      toast({
        title: 'Backup completed',
        description: `Copied ${result.bytes_copied.toLocaleString()} bytes to ${result.destination_path}`,
      });
    } catch (error) {
      toast({
        title: 'Backup failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setSavingBackup(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Backup Data Locally</h1>
        <p className="text-muted-foreground">
          Replicate your app database (`finance.db`) to a folder on your computer. Default destination is your OneDrive folder.
          If a file with the same name exists, a number will be appended automatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Local Backup</CardTitle>
          <CardDescription>Choose where to save a local copy of your BudgetBuddy database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-destination">Destination Directory</Label>
            <Input
              id="backup-destination"
              value={destinationDirectory}
              onChange={(event) => setDestinationDirectory(event.target.value)}
              placeholder={loadingDefault ? 'Loading OneDrive path...' : 'e.g., C:\\Users\\you\\OneDrive'}
              disabled={loadingDefault}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="backup-file-name">Backup File Name</Label>
            <Input
              id="backup-file-name"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="finance.db"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleBackup} disabled={loadingDefault || savingBackup}>
              {savingBackup ? 'Backing up...' : 'Backup Data Locally'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
