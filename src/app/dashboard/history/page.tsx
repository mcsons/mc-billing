'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ChevronsUpDown, Search, Trash2, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { Checkbox } from '@/components/ui/checkbox';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { useToast } from '@/hooks/use-toast';
import { LiveBillSummary } from '@/lib/data';
import ReactSelect from 'react-select';


export default function HistoryPage() {
  const { liveBillSummaries, customers, deleteBills, currentUser } = useData();
  const router = useRouter();
  const showAlertDialog = useAlertDialog();
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>();

  const [selectedCustomer, setSelectedCustomer] = React.useState<string>('');
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());

  const [filteredBills, setFilteredBills] = useState<LiveBillSummary[]>(liveBillSummaries);

  useEffect(() => {
    // Keep the filtered list in sync with the source if no filters are active
    if (!date && !selectedCustomer) {
      setFilteredBills(liveBillSummaries);
    }
  }, [liveBillSummaries, date, selectedCustomer]);


  const handleEditBill = (billNo: string) => {
    router.push(`/dashboard?billNo=${billNo}`);
  };

  const selectedCustomerData = customers.find(
    (c) => c.id.toLowerCase() === selectedCustomer.toLowerCase()
  );


  const handleSelectBill = (billNo: string, checked: boolean) => {
    setSelectedBills((prev) => {
      const newSelection = new Set(prev);
      if (checked) {
        newSelection.add(billNo);
      } else {
        newSelection.delete(billNo);
      }
      return newSelection;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBills(new Set(filteredBills.map((bill) => bill.billNo)));
    } else {
      setSelectedBills(new Set());
    }
  };

  const canDelete = useMemo(() => {
    return currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN';
  }, [currentUser]);


  const handleDeleteSelected = () => {
    if (selectedBills.size === 0) {
      toast({
        variant: 'destructive',
        title: 'No Bills Selected',
        description: 'Please select at least one bill to delete.',
      });
      return;
    }
    showAlertDialog({
      title: 'Are you sure?',
      description: `This will permanently delete ${selectedBills.size} bill(s). This action cannot be undone.`,
      onConfirm: () => {
        deleteBills(Array.from(selectedBills));
        setSelectedBills(new Set());
      },
    });
  };

  const handleSearch = () => {
    let results = liveBillSummaries;

    if (selectedCustomer) {
      const custData = customers.find(c => c.id === selectedCustomer);
      if (custData) {
        results = results.filter(bill => bill.customerName.includes(custData.name_en));
      }
    }

    if (date) {
      results = results.filter(bill => bill.date && isSameDay(bill.date, date));
    }

    setFilteredBills(results);
  };

  const handleClearSearch = () => {
    setDate(undefined);
    setSelectedCustomer('');
    setFilteredBills(liveBillSummaries);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row justify-between items-center">
        <div>
          <CardTitle className="font-headline">Bill History</CardTitle>
          <CardDescription>
            Search and view past bills. Double-click a row to open and edit.
          </CardDescription>
        </div>
        {selectedBills.size > 0 && canDelete && (
          <Button variant="destructive" onClick={handleDeleteSelected}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected ({selectedBills.size})
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="grid gap-2 flex-1">
            <Label htmlFor="customer-search">Customer</Label>
            <ReactSelect
              instanceId="history-customer-select"
              placeholder="Select customer..."
              isClearable
              options={customers.map((c) => ({
                value: c.id,
                label: `${c.name_en} (${c.name_ta})`,
              }))}
              value={
                selectedCustomerData
                  ? {
                    value: selectedCustomerData.id,
                    label: `${selectedCustomerData.name_en} (${selectedCustomerData.name_ta})`,
                  }
                  : null
              }
              onChange={(option) => {
                setSelectedCustomer(option ? option.value : '');
              }}
              styles={{
                menu: (base) => ({ ...base, zIndex: 50 }),
              }}
              filterOption={(option, input) =>
                option.label.toLowerCase().includes(input.toLowerCase()) ||
                option.value.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="date-search">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full sm:w-[240px] justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="self-end flex gap-2">
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button variant="ghost" onClick={handleClearSearch}>
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead className="w-[40px] text-center">
                  <Checkbox
                    checked={
                      filteredBills.length > 0 &&
                      selectedBills.size === filteredBills.length
                    }
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead>Bill No</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Stall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBills.length > 0 ? (
              filteredBills.map((bill) => (
                <TableRow
                  key={bill.billNo}
                  className="cursor-pointer"
                  onDoubleClick={() => handleEditBill(bill.billNo)}
                  data-state={selectedBills.has(bill.billNo) && 'selected'}
                >
                  {canDelete && (
                    <TableCell className="w-[40px] text-center">
                      <Checkbox
                        checked={selectedBills.has(bill.billNo)}
                        onCheckedChange={(checked) =>
                          handleSelectBill(bill.billNo, !!checked)
                        }
                        aria-label={`Select bill ${bill.billNo}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{bill.billNo}</TableCell>
                  <TableCell>{bill.customerName}</TableCell>
                  <TableCell className="text-right">
                    ₹{bill.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{bill.createdBy}</TableCell>
                  <TableCell>{bill.stall}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={canDelete ? 6 : 5} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
