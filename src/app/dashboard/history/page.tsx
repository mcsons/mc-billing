'use client';
import React, { useState, useMemo } from 'react';
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
import { Check, ChevronsUpDown, Search, Trash2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { Checkbox } from '@/components/ui/checkbox';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { useToast } from '@/hooks/use-toast';

export default function HistoryPage() {
  const { liveBillSummaries, customers, deleteBills, currentUser } = useData();
  const router = useRouter();
  const showAlertDialog = useAlertDialog();
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [customerPopoverOpen, setCustomerPopoverOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<string>('');
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());

  const handleEditBill = (billNo: string) => {
    router.push(`/dashboard?billNo=${billNo}`);
  };

  const selectedCustomerData = customers.find(
    (c) => c.id.toLowerCase() === selectedCustomer.toLowerCase()
  );

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomer(customerId === selectedCustomer ? '' : customerId);
    setCustomerPopoverOpen(false);
  };

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
      setSelectedBills(new Set(liveBillSummaries.map((bill) => bill.billNo)));
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
            <Popover
              open={customerPopoverOpen}
              onOpenChange={setCustomerPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerPopoverOpen}
                  className="justify-between"
                  onClick={() => setCustomerPopoverOpen(!customerPopoverOpen)}
                >
                  {selectedCustomerData
                    ? `${selectedCustomerData?.name_en} (${selectedCustomerData?.name_ta})`
                    : 'Select customer...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search customer..." />
                  <CommandList>
                    <CommandEmpty>No customer found.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={`${customer.name_en} ${customer.name_ta} ${customer.id}`}
                          onSelect={() => handleCustomerSelect(customer.id)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedCustomer.toLowerCase() ===
                                customer.id.toLowerCase()
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {customer.name_en} ({customer.name_ta})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="date-search">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'justify-start text-left font-normal',
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
          <div className="self-end">
            <Button>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead padding="checkbox">
                  <Checkbox
                    checked={
                      liveBillSummaries.length > 0 &&
                      selectedBills.size === liveBillSummaries.length
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
            {liveBillSummaries.map((bill) => (
              <TableRow
                key={bill.billNo}
                className="cursor-pointer"
                onDoubleClick={() => handleEditBill(bill.billNo)}
                data-state={selectedBills.has(bill.billNo) && 'selected'}
              >
                {canDelete && (
                  <TableCell padding="checkbox">
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
