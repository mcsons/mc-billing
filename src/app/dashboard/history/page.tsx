'use client';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import { Search, Trash2, X } from 'lucide-react';
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
import { Timestamp } from 'firebase/firestore';


export default function HistoryPage() {
  const { liveBillSummaries, customers, users, deleteBills, currentUser } = useData();
  const router = useRouter();
  const showAlertDialog = useAlertDialog();
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>();

  const [selectedCustomer, setSelectedCustomer] = React.useState<string>('');
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());

  const [filteredBills, setFilteredBills] = useState<LiveBillSummary[]>([]);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  const reactSelectStyles = {
    control: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    menu: (baseStyles: any) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--card))',
      zIndex: 50,
    }),
    option: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: state.isSelected
        ? 'hsl(var(--accent))'
        : state.isFocused
        ? 'hsl(var(--muted))'
        : 'transparent',
      color: state.isSelected
        ? 'hsl(var(--accent-foreground))'
        : 'hsl(var(--foreground))',
      '&:active': {
        backgroundColor: 'hsl(var(--accent))',
      },
    }),
    singleValue: (baseStyles: any) => ({
      ...baseStyles,
      color: 'hsl(var(--foreground))',
    }),
    input: (baseStyles: any) => ({
      ...baseStyles,
      color: 'hsl(var(--foreground))',
    }),
     placeholder: (baseStyles: any) => ({
      ...baseStyles,
      color: 'hsl(var(--muted-foreground))',
    }),
  };

  const sortBills = (bills: LiveBillSummary[]): LiveBillSummary[] => {
    return [...bills].sort((a, b) => {
      const dateA = a.date ? ((a.date as any).toDate ? (a.date as any).toDate() : new Date(a.date as any)) : new Date(0);
      const dateB = b.date ? ((b.date as any).toDate ? (b.date as any).toDate() : new Date(b.date as any)) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  };

  useEffect(() => {
    setFilteredBills(sortBills(liveBillSummaries));
  }, [liveBillSummaries]);


  const handleEditBill = (billNo: string) => {
    router.push(`/dashboard/billing?billNo=${billNo}`);
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

  const handleSearch = useCallback(() => {
    let results = liveBillSummaries;

    if (selectedCustomer) {
      const custData = customers.find(c => c.id === selectedCustomer);
      if (custData) {
        results = results.filter(bill => bill.customerName.includes(custData.name_en));
      }
    }

    if (date) {
      results = results.filter(bill => {
        if (!bill.date) return false;
        // The date from firestore can be a Timestamp object
        const billDate = (bill.date as Timestamp).toDate ? (bill.date as Timestamp).toDate() : bill.date;
        return isSameDay(billDate, date);
      });
    }

    setFilteredBills(sortBills(results));
  }, [customers, date, liveBillSummaries, selectedCustomer]);
  
  const handleCustomerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const firstRow = tableBodyRef.current?.querySelector('tr');
      if (firstRow) {
        (firstRow as HTMLElement).focus();
      }
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, billNo: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditBill(billNo);
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextRow = e.currentTarget.nextElementSibling as HTMLElement;
        nextRow?.focus();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevRow = e.currentTarget.previousElementSibling as HTMLElement;
        prevRow?.focus();
    }
  };


  const handleClearSearch = () => {
    setDate(undefined);
    setSelectedCustomer('');
    setFilteredBills(sortBills(liveBillSummaries));
  };

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="font-headline">Bill History</CardTitle>
          <CardDescription>
            Search and view past bills. Enter on a row to open and edit.
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
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end">
          <div className="grid flex-1 gap-2">
            <label htmlFor="customer-search-select" className="text-sm font-medium">Customer</label>
             <div onKeyDown={handleCustomerKeyDown}>
                <ReactSelect
                instanceId="history-customer-select"
                inputId="customer-search-select"
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
                    const newCustomerId = option ? option.value : '';
                    setSelectedCustomer(newCustomerId);
                
                    let results = liveBillSummaries;
                    if (newCustomerId) {
                        const custData = customers.find(c => c.id === newCustomerId);
                        if (custData) {
                            results = results.filter(bill => bill.customerName.includes(custData.name_en));
                        }
                    }
                    // Also filter by date if it's set
                    if (date) {
                        results = results.filter(bill => {
                            if (!bill.date) return false;
                            const billDate = (bill.date as Timestamp).toDate ? (bill.date as Timestamp).toDate() : bill.date;
                            return isSameDay(billDate, date);
                        });
                    }
                    setFilteredBills(sortBills(results));
                }}
                styles={reactSelectStyles}
                filterOption={(option, input) =>
                    option.label.toLowerCase().includes(input.toLowerCase()) ||
                    option.value.toLowerCase().includes(input.toLowerCase())
                }
                />
            </div>
          </div>
          <div className="grid gap-2">
            <label htmlFor="date-search-trigger" className="text-sm font-medium">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-search-trigger"
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
          <div className="flex gap-2">
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

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {canDelete && (
                  <TableHead className="w-[40px] text-center">
                    {/* Removed Select All */}
                  </TableHead>
                )}
                <TableHead>Bill No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {filteredBills.length > 0 ? (
                filteredBills.map((bill) => {
                  const creator = users.find((user) => user.id === bill.createdBy);
                  const billDate = bill.date ? ((bill.date as any).toDate ? (bill.date as any).toDate() : new Date(bill.date)) : null;

                  return (
                    <TableRow
                      key={bill.billNo}
                      className="cursor-pointer"
                      onDoubleClick={() => handleEditBill(bill.billNo)}
                      data-state={selectedBills.has(bill.billNo) && 'selected'}
                      tabIndex={0}
                      onKeyDown={(e) => handleRowKeyDown(e, bill.billNo)}
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
                      <TableCell>
                        {billDate ? format(billDate, 'dd-MM-yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell>{bill.customerName}</TableCell>
                      <TableCell className="text-right">
                        ₹{bill.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{creator?.username || bill.createdBy}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={canDelete ? 6 : 5} className="h-24 text-center">
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
