'use client';
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Lock,
  PlusCircle,
  Search,
  Unlock,
  Printer,
  FilePlus,
} from 'lucide-react';
import { liveHistoryItems, BillItem } from '@/lib/data';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default function BillingPage() {
  const [isProductLocked, setIsProductLocked] = useState(false);
  const [currentBillItems, setCurrentBillItems] = useState<BillItem[]>([]);
  const [date, setDate] = React.useState<Date>()

  const handleAddItem = () => {
    // This is a mock function. In a real app, this would use form data.
    const newItem: BillItem = {
      id: currentBillItems.length + 1,
      product: 'இறால்',
      uom: 'KGS',
      qty: 2,
      rate: 1200,
      amount: 2400,
      user: 'Admin',
      stall: '1'
    };
    setCurrentBillItems([...currentBillItems, newItem]);
  };
  
  const handleNewBill = () => {
    setCurrentBillItems([]);
    setDate(new Date());
    // You might want to reset other form fields here as well
  };

  const totalAmount = currentBillItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
            <div>
                <CardTitle className="font-headline">Create Bill</CardTitle>
                <CardDescription>
                    Select customer, add products, and generate a bill. Today is {new Date().toLocaleDateString()}.
                </CardDescription>
            </div>
            <Button variant="outline" onClick={handleNewBill}>
                <FilePlus className="mr-2 h-4 w-4" />
                New Bill
            </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="grid gap-2">
                <Label htmlFor="bill-date">Bill Date</Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
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
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer (ID, பெயர், Name)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer"
                  placeholder="Search customer..."
                  className="pl-8"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stall">Stall</Label>
              <Select defaultValue="1">
                <SelectTrigger>
                  <SelectValue placeholder="Select stall" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Stall 1</SelectItem>
                  <SelectItem value="2">Stall 2</SelectItem>
                  <SelectItem value="3">Stall 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-6 lg:grid-cols-7 items-end">
            <div className="grid gap-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="product">Product (ID, பெயர், Name)</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="product"
                  placeholder="Search product..."
                  className="pl-8"
                  disabled={isProductLocked}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => setIsProductLocked(!isProductLocked)}
                >
                  {isProductLocked ? (
                    <Unlock className="h-4 w-4" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {isProductLocked ? 'Unlock Product' : 'Lock Product'}
                  </span>
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="uom">UOM</Label>
              <Select defaultValue="KGS">
                <SelectTrigger id="uom">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KGS">KGS</SelectItem>
                  <SelectItem value="BOX">BOX</SelectItem>
                  <SelectItem value="NOS">NOS</SelectItem>
                  <SelectItem value="ITEMS">ITEMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qty">Qty</Label>
              <Input id="qty" type="number" placeholder="0.00" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">Rate (₹)</Label>
              <Input id="rate" type="number" placeholder="0.00" />
            </div>
            <div className="md:col-span-6 lg:col-span-1">
              <Button onClick={handleAddItem} className="w-full" size="sm">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="current-bill">
        <TabsList>
          <TabsTrigger value="current-bill">Current Bill</TabsTrigger>
          <TabsTrigger value="live-history">Live History (Today)</TabsTrigger>
        </TabsList>
        <TabsContent value="current-bill">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Current Bill</CardTitle>
              <CardDescription>Items added for the selected customer.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>S/N</TableHead>
                        <TableHead>Product (பெயர்)</TableHead>
                        <TableHead>UOM</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Rate (₹)</TableHead>
                        <TableHead className="text-right">Amount (₹)</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {currentBillItems.length > 0 ? currentBillItems.map((item) => (
                        <TableRow key={item.id}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell className="font-medium">{item.product}</TableCell>
                        <TableCell>{item.uom}</TableCell>
                        <TableCell className="text-right">{item.qty.toFixed(3)}</TableCell>
                        <TableCell className="text-right">{item.rate.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.amount.toFixed(2)}</TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center">No items added yet.</TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="flex flex-col items-end gap-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right text-lg">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold font-mono">₹{totalAmount.toFixed(2)}</span>
                    <span className="font-semibold">Prev Balance:</span>
                    <span className="font-mono">₹500.00</span>
                     <span className="font-semibold">Paid:</span>
                    <Input className="max-w-32 text-right font-mono" placeholder="₹1000.00" />
                    <span className="font-semibold">Balance:</span>
                    <span className="font-bold font-mono">₹1700.00</span>
                </div>
                <Button size="lg">
                    <Printer className="mr-2 h-4 w-4"/>
                    Print Bill
                </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="live-history">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">Live Bill History</CardTitle>
              <CardDescription>All items entered today. Double-click a row to edit.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Stall</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveHistoryItems.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer">
                      <TableCell className="font-medium">{item.product}</TableCell>
                      <TableCell>{item.uom}</TableCell>
                      <TableCell className="text-right">{item.qty.toFixed(3)}</TableCell>
                      <TableCell className="text-right">₹{item.amount.toFixed(2)}</TableCell>
                      <TableCell>{item.user}</TableCell>
                      <TableCell>{item.stall}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
