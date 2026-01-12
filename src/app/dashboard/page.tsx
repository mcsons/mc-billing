'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Trash2,
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
import { useToast } from '@/hooks/use-toast';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { 
    customers, 
    products, 
    productPrices, 
    customerBalances,
    currentUser,
    findBillForCustomerToday,
    getBillItems,
    createOrUpdateLiveBill,
  } = useData();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  const [isProductLocked, setIsProductLocked] = useState(false);
  
  const [activeBillNo, setActiveBillNo] = useState<string | null>(null);
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [initialBillTotal, setInitialBillTotal] = useState(0);

  // Form state for new item
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [uom, setUom] = useState('KGS');
  const [paidAmount, setPaidAmount] = useState('');


  // This effect runs when a bill number is passed in the URL (for editing old bills)
  useEffect(() => {
    const billNoFromParams = searchParams.get('billNo');
    if (billNoFromParams) {
      // Logic to load a historical bill for editing
      const billToEdit = findBillForCustomerToday(selectedCustomerId); // This needs adjustment for historical
      if (billToEdit) {
        setActiveBillNo(billToEdit.billNo);
        const customer = customers.find(c => billToEdit.customerName.includes(c.name_en));
        setSelectedCustomerId(customer?.id || '');
        setBillItems(getBillItems(billToEdit.billNo)); 
        setInitialBillTotal(billToEdit.amount);
        setPaidAmount('');
      }
    }
  }, [searchParams, customers, findBillForCustomerToday, getBillItems]);

  // Effect to set the rate when product/uom changes
  useEffect(() => {
    if (selectedProductId && uom) {
      const price = productPrices[selectedProductId]?.[uom] || '';
      setRate(price.toString());
    } else {
      setRate('');
    }
  }, [selectedProductId, uom, productPrices]);
  
  // New effect to handle customer selection and load existing bills
  useEffect(() => {
    if (selectedCustomerId) {
      const existingBill = findBillForCustomerToday(selectedCustomerId);
      if (existingBill) {
        setActiveBillNo(existingBill.billNo);
        setBillItems(getBillItems(existingBill.billNo));
        setInitialBillTotal(existingBill.amount);
      } else {
        // No existing bill, start a new one
        setActiveBillNo(null);
        setBillItems([]);
        setInitialBillTotal(0);
      }
      setPaidAmount('');
    }
  }, [selectedCustomerId, findBillForCustomerToday, getBillItems]);

  const handleAddItem = () => {
    if (!selectedCustomerId) {
      toast({
        variant: "destructive",
        title: "No Customer Selected",
        description: "Please select a customer before adding items.",
      });
      return;
    }

    const productInfo = products.find((p) => p.id === selectedProductId);
    if (!productInfo || !qty || !rate) {
        toast({
            variant: "destructive",
            title: "Missing Information",
            description: "Please select a product and enter quantity and rate.",
        });
        return;
    }
    
    const qtyNum = parseFloat(qty);
    const rateNum = parseFloat(rate);

    const newItem: BillItem = {
      id: Date.now(), // Use timestamp for unique ID in local state
      product: productInfo.name_ta,
      uom: uom,
      qty: qtyNum,
      rate: rateNum,
      amount: qtyNum * rateNum,
      user: currentUser?.username || 'N/A',
      stall: '1', // This should be dynamic
    };

    setBillItems(prev => [...prev, newItem]);

    // Reset fields
    setQty('');
    if (!isProductLocked) {
        setSelectedProductId('');
        setRate('');
    }
  };

  const handleRemoveItem = (itemId: number) => {
    setBillItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleNewBill = () => {
    setSelectedCustomerId('');
    setActiveBillNo(null);
    setBillItems([]);
    setDate(new Date());
    setSelectedProductId('');
    setQty('');
    setRate('');
    setPaidAmount('');
    setInitialBillTotal(0);
    router.replace('/dashboard');
  };
  
  const handleSaveBill = () => {
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer || billItems.length === 0) {
      toast({
          variant: "destructive",
          title: "Cannot Save Bill",
          description: "A customer must be selected and at least one item must be added.",
      });
      return;
    }

    const newBillSummary = {
        customerName: `${customer.name_en} (${customer.name_ta})`,
        createdBy: currentUser?.username || 'N/A', // Should be dynamic
        stall: '1', // Should be dynamic
    };

    const paidAmountNum = parseFloat(paidAmount) || 0;
    
    const billNo = createOrUpdateLiveBill(newBillSummary, billItems, paidAmountNum, activeBillNo);
    
    if (activeBillNo) {
        toast({
            title: "Bill Updated",
            description: `Bill ${billNo} has been successfully updated.`,
        });
    } else {
        toast({
            title: "Bill Saved",
            description: `A new bill (${billNo}) has been successfully created.`,
        });
    }

    handleNewBill(); // Clear everything for the next bill
  };

  const handlePrintBill = () => {
    if (!selectedCustomerId || billItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot Print Bill',
        description: 'A customer must be selected and items must be added.',
      });
      return;
    }

    const billData = {
      billNo: activeBillNo || 'NEW',
      date: date?.toISOString() || new Date().toISOString(),
      customer: selectedCustomerData,
      items: billItems,
      totalAmount,
      previousBalance,
      paidAmount: parseFloat(paidAmount) || 0,
      finalBalance,
      stall: '1', // Should be dynamic
    };

    const encodedData = encodeURIComponent(JSON.stringify(billData));
    window.open(`/dashboard/print?data=${encodedData}`, '_blank');
  };

  const totalAmount = useMemo(() => billItems.reduce(
    (sum, item) => sum + item.amount,
    0
  ), [billItems]);

  const previousBalance = useMemo(() => {
      if (!selectedCustomerId) return 0;
      // When loading an existing bill, the `initialBillTotal` is part of the customer's balance already.
      // We subtract it to show the balance *before* this bill was created/loaded.
      return (customerBalances[selectedCustomerId] || 0) - initialBillTotal;
  }, [selectedCustomerId, customerBalances, initialBillTotal]);
  
  const finalBalance = previousBalance + totalAmount - (parseFloat(paidAmount) || 0);

  const selectedCustomerData = customers.find(
    (c) => c.id.toLowerCase() === selectedCustomerId.toLowerCase()
  );
  const selectedProductData = products.find(
    (p) => p.id.toLowerCase() === selectedProductId.toLowerCase()
  );
  
  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find(p => p.id === productId);
    if (product && product.uom_allowed.length > 0) {
      setUom(product.uom_allowed[0]);
    }
    setProductPopoverOpen(false);
  }

  const handleCustomerSelect = useCallback((customerId: string) => {
    if (customerId !== selectedCustomerId) {
      setSelectedCustomerId(customerId);
    }
    setCustomerPopoverOpen(false);
  }, [selectedCustomerId]);


  return (
    <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <div>
            <CardTitle className="font-headline">{activeBillNo ? `Editing Bill ${activeBillNo}`: 'Create Bill'}</CardTitle>
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
                            value={customer.id}
                            onSelect={handleCustomerSelect}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedCustomerId === customer.id
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
                      disabled={isProductLocked || !selectedCustomerId}
                    >
                      {selectedProductData
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
                              value={product.id}
                              onSelect={() => handleProductSelect(product.id)}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedProductId === product.id
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
                  disabled={!selectedCustomerId}
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
              <Select value={uom} onValueChange={setUom} disabled={!selectedProductData}>
                <SelectTrigger id="uom">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {selectedProductData?.uom_allowed.map(uom => (
                     <SelectItem key={uom} value={uom}>{uom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qty">Qty</Label>
              <Input id="qty" type="number" placeholder="0.00" value={qty} onChange={e => setQty(e.target.value)} disabled={!selectedCustomerId}/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">Rate (₹)</Label>
              <Input id="rate" type="number" placeholder="0.00" value={rate} onChange={e => setRate(e.target.value)} disabled={!selectedCustomerId}/>
            </div>
            <div className="md:col-span-6 lg:col-span-1">
              <Button onClick={handleAddItem} className="w-full" size="sm" disabled={!selectedCustomerId}>
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
            {selectedCustomerId 
              ? `Items added for ${selectedCustomerData?.name_en}.`
              : 'Select a customer to view or create a bill.'
            }
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billItems.length > 0 ? (
                billItems.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>{index + 1}</TableCell>
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
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete item</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">
                    {selectedCustomerId ? 'No items added yet.' : 'Select a customer to begin.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {selectedCustomerId && (<CardFooter className="flex flex-col items-end gap-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right text-lg">
            <span className="font-semibold">Total:</span>
            <span className="font-bold font-mono">
              ₹{totalAmount.toFixed(2)}
            </span>
            <span className="font-semibold">Prev Balance:</span>
            <span className="font-mono">₹{previousBalance.toFixed(2)}</span>
            <span className="font-semibold">Paid:</span>
            <Input
              className="max-w-32 text-right font-mono"
              placeholder="0.00"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
            <span className="font-semibold">Balance:</span>
            <span className="font-bold font-mono">₹{finalBalance.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Button size="lg" variant="outline" onClick={handleSaveBill}>
              <Save className="mr-2 h-4 w-4" />
              Save Bill
            </Button>
            <Button size="lg" onClick={handlePrintBill}>
              <Printer className="mr-2 h-4 w-4" />
              Print Bill
            </Button>
          </div>
        </CardFooter>)}
      </Card>
    </div>
  );
}
