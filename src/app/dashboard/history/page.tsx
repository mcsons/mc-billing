'use client';
import React, { useState } from 'react';
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
import { Search } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { liveBillSummaries } from '@/lib/data';

export default function HistoryPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Bill History</CardTitle>
        <CardDescription>
          Search and view past bills. Double-click a row to open and edit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="grid gap-2 flex-1">
            <Label htmlFor="customer-search">Customer or Bill No.</Label>
            <Input id="customer-search" placeholder="Search by ID or Name" />
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
                <TableHead>Bill No</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Stall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liveBillSummaries.map((bill) => (
                <TableRow key={bill.billNo} className="cursor-pointer" onDoubleClick={() => console.log(`Editing bill ${bill.billNo}`)}>
                    <TableCell className="font-medium">{bill.billNo}</TableCell>
                    <TableCell>{bill.customerName}</TableCell>
                    <TableCell className="text-right">₹{bill.amount.toFixed(2)}</TableCell>
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
