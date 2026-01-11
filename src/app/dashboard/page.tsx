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
  Lock,
  PlusCircle,
  Unlock,
  Printer,
  FilePlus,
  ChevronsUpDown,
  Check,
  Save,
} from 'lucide-react';
import { BillItem } from '@/lib/data';
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

export default function BillingPage() {
  const { customers, products, addBillItem, currentBillItems, clearBill } = useData();
  const [isProductLocked, setIsProductLocked] = useState(false);
  const [date, setDate] = React.useState<Date>();

  const [customerPopoverOpen, setCustomerPopoverOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<string>('');

  const [productPopoverOpen, setProductPopoverOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<string>('');

  const handleAddItem = () => {
    // This is a mock function. In a real app, this would use form data.
    const productInfo = products.find((p) => p.id === selectedProduct);
    const newItem: BillItem = {
      id: currentBillItems.length + 1,
      product: productInfo ? productInfo.name_ta : 'இறால்',
      uom: 'KGS',
      qty: 2,
      rate: 1200,
      amount: 2400,
      user: 'Admin',
      stall: '1',
    };
    addBillItem(newItem);
  };

  const handleNewBill = () => {
    clearBill();
    setDate(new Date());
    setSelectedCustomer('');
    setSelectedProduct('');
    // You might want to reset other form fields here as well
  };

  const totalAmount = currentBillItems.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  const selectedCustomerData = customers.find(
    (c) => c.id.toLowerCase() === selectedCustomer.toLowerCase()
  );
  const selectedProductData = products.find(
    (p) => p.id.toLowerCase() === selectedProduct.toLowerCase()
  );

  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="font-headline">Create Bill</CardTitle>
            <CardDescription>
              Select customer, add products, and generate a bill. Today is{' '}
              {new Date().toLocaleDateString()}.
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
            <div className="grid gap-2">
              <Label htmlFor="customer">Customer (ID, பெயர், Name)</Label>
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
                  >
                    {selectedCustomer
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
                            value={`${customer.id} ${customer.name_en} ${customer.name_ta}`}
                            onSelect={(currentValue) => {
                              const customerId =
                                customers.find(
                                  (c) =>
                                    `${c.id} ${c.name_en} ${c.name_ta}`.toLowerCase() ===
                                    currentValue
                                )?.id || '';
                              setSelectedCustomer(customerId);
                              setCustomerPopoverOpen(false);
                            }}
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
                <Popover
                  open={productPopoverOpen}
                  onOpenChange={setProductPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={productPopoverOpen}
                      className="w-full justify-between"
                      disabled={isProductLocked}
                    >
                      {selectedProduct
                        ? `${selectedProductData?.name_en} (${selectedProductData?.name_ta})`
                        : 'Select product...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search product..." />
                      <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`${product.id} ${product.name_en} ${product.name_ta}`}
                              onSelect={(currentValue) => {
                                const productId =
                                  products.find(
                                    (p) =>
                                      `${p.id} ${p.name_en} ${p.name_ta}`.toLowerCase() ===
                                      currentValue
                                  )?.id || '';
                                setSelectedProduct(productId);
                                setProductPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedProduct.toLowerCase() ===
                                    product.id.toLowerCase()
                                    ? 'opacity-100'
                                    : 'opacity-0'
                                )}
                              />
                              {product.name_en} ({product.name_ta})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Current Bill</CardTitle>
          <CardDescription>
            Items added for the selected customer.
          </CardDescription>
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
              {currentBillItems.length > 0 ? (
                currentBillItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell className="font-medium">{item.product}</TableCell>
                    <TableCell>{item.uom}</TableCell>
                    <TableCell className="text-right">
                      {item.qty.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.rate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No items added yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="flex flex-col items-end gap-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right text-lg">
            <span className="font-semibold">Total:</span>
            <span className="font-bold font-mono">
              ₹{totalAmount.toFixed(2)}
            </span>
            <span className="font-semibold">Prev Balance:</span>
            <span className="font-mono">₹500.00</span>
            <span className="font-semibold">Paid:</span>
            <Input
              className="max-w-32 text-right font-mono"
              placeholder="₹1000.00"
            />
            <span className="font-semibold">Balance:</span>
            <span className="font-bold font-mono">₹1700.00</span>
          </div>
          <div className="flex gap-2">
            <Button size="lg" variant="outline">
              <Save className="mr-2 h-4 w-4" />
              Save Bill
            </Button>
            <Button size="lg">
              <Printer className="mr-2 h-4 w-4" />
              Print Bill
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
