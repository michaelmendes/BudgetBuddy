import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { usePayCycles } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

function escapeCsv(value: string | number): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function DataExportPage() {
  const { toast } = useToast();
  const { data: cycles = [], isLoading } = usePayCycles();
  const [selectedCycleIds, setSelectedCycleIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const closedCycles = useMemo(
    () => cycles.filter((cycle) => cycle.status === 'closed'),
    [cycles]
  );

  const allSelected = closedCycles.length > 0 && selectedCycleIds.length === closedCycles.length;

  const toggleCycle = (cycleId: string, checked: boolean) => {
    setSelectedCycleIds((current) => {
      if (checked) return [...new Set([...current, cycleId])];
      return current.filter((id) => id !== cycleId);
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedCycleIds(checked ? closedCycles.map((cycle) => cycle.id) : []);
  };

  const handleExport = async () => {
    if (selectedCycleIds.length === 0) {
      toast({
        title: 'No cycles selected',
        description: 'Select at least one closed pay cycle to export.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsExporting(true);

      const rows: string[][] = [[
        'Cycle Start',
        'Cycle End',
        'Cycle Status',
        'Actual Paycheck',
        'Total Spent',
        'Total Saved',
        'Category',
        'Starting Balance',
        'Amount Spent',
        'Amount Allocated',
        'Closing Balance',
      ]];

      for (const cycleId of selectedCycleIds) {
        const cycle = closedCycles.find((item) => item.id === cycleId);
        if (!cycle) continue;

        const [summary, balances] = await Promise.all([
          api.getPayCycleSummary(cycleId).catch(() => null),
          api.getPayCycleCategoryBalances(cycleId),
        ]);

        if (balances.length === 0) {
          rows.push([
            format(parseISO(cycle.start_date), 'yyyy-MM-dd'),
            format(parseISO(cycle.end_date), 'yyyy-MM-dd'),
            cycle.status,
            cycle.income_amount,
            summary?.total_expenses ?? '0.00',
            summary?.total_savings ?? '0.00',
            '',
            '0.00',
            '0.00',
            '0.00',
            '0.00',
          ]);
          continue;
        }

        balances.forEach((balance) => {
          rows.push([
            format(parseISO(cycle.start_date), 'yyyy-MM-dd'),
            format(parseISO(cycle.end_date), 'yyyy-MM-dd'),
            cycle.status,
            cycle.income_amount,
            summary?.total_expenses ?? '0.00',
            summary?.total_savings ?? '0.00',
            balance.category_name,
            balance.starting_balance,
            balance.spent,
            balance.paycheck_allocated,
            balance.closing_balance,
          ]);
        });
      }

      const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budgetbuddy-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Export ready', description: 'Your data export has been downloaded.' });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Export Data</h1>
        <p className="text-muted-foreground">Select closed pay cycles to export into an Excel-compatible CSV file.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Choose Pay Cycles</CardTitle>
          <CardDescription>Check all cycles you want to include in the export.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading pay cycles...</p>
          ) : closedCycles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No closed pay cycles available to export.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b pb-3">
                <Checkbox
                  id="select-all-cycles"
                  checked={allSelected}
                  onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                />
                <Label htmlFor="select-all-cycles" className="font-medium">Select all</Label>
              </div>

              <div className="space-y-3">
                {closedCycles.map((cycle) => {
                  const checked = selectedCycleIds.includes(cycle.id);
                  return (
                    <div key={cycle.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`cycle-${cycle.id}`}
                          checked={checked}
                          onCheckedChange={(value) => toggleCycle(cycle.id, Boolean(value))}
                        />
                        <Label htmlFor={`cycle-${cycle.id}`} className="cursor-pointer">
                          {format(parseISO(cycle.start_date), 'MMM d, yyyy')} - {format(parseISO(cycle.end_date), 'MMM d, yyyy')}
                        </Label>
                      </div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">{cycle.status}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleExport} disabled={isExporting || selectedCycleIds.length === 0}>
                  {isExporting ? 'Exporting...' : 'Export Selected'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
