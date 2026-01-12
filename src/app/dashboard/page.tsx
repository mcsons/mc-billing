'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { useAlertDialog } from '@/context/AlertDialogProvider';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();
  const {
    customers,
    products,
    productPrices,
    customerBalances,
    currentUser,
    findBillForCustomerToday,
    getBillItems,
    createOrUpdateLiveBill,
    removeBillItem,
    getBill,
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
  
  const productInputRef = useRef<HTMLButtonElement>(null);


  // This effect runs when a bill number is passed in the URL (for editing old bills)
  useEffect(() => {
    const billNoFromParams = searchParams.get('billNo');
    if (billNoFromParams) {
      const billToEdit = getBill(billNoFromParams);
      if (billToEdit) {
        const customer = customers.find(c => billToEdit.customerName.includes(c.name_en));
        if (customer) {
            setSelectedCustomerId(customer.id);
            setActiveBillNo(billToEdit.billNo);
            setBillItems(getBillItems(billToEdit.billNo));
            setInitialBillTotal(billToEdit.amount);
            setPaidAmount('');
            setDate(new Date(billToEdit.date || new Date()));
        }
      }
    }
  }, [searchParams, customers, getBillItems, getBill]);

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
    if (selectedCustomerId && !searchParams.get('billNo')) {
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
  }, [selectedCustomerId, findBillForCustomerToday, getBillItems, searchParams]);
  
  const handleAddItem = () => {
    if (!selectedCustomerId) {
      toast({
        variant: 'destructive',
        title: 'No Customer Selected',
        description: 'Please select a customer before adding items.',
      });
      return;
    }

    const productInfo = products.find((p) => p.id === selectedProductId);
    if (!productInfo || !qty || !rate) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please select a product and enter quantity and rate.',
      });
      return;
    }

    const qtyNum = parseFloat(qty);
    const rateNum = parseFloat(rate);

    const newItem: BillItem = {
      id: Date.now(), // Use timestamp for unique ID in local state
      product: productInfo.name_ta,
      productId: productInfo.id,
      uom: uom,
      qty: qtyNum,
      rate: rateNum,
      amount: qtyNum * rateNum,
      user: currentUser?.username || 'N/A',
      stall: '1', // This should be dynamic
    };

    const newBillItems = [...billItems, newItem];
    setBillItems(newBillItems);

    // Save immediately
    const customer = customers.find(c => c.id === selectedCustomerId);
    if(customer) {
        const newBillSummary = {
            customerName: `${customer.name_en} (${customer.name_ta})`,
            createdBy: currentUser?.username || 'N/A',
            stall: '1',
            date: date || new Date(),
        };
        const updatedBillNo = createOrUpdateLiveBill(newBillSummary, newBillItems, parseFloat(paidAmount) || 0, activeBillNo);
        if (!activeBillNo) {
            setActiveBillNo(updatedBillNo);
        }
    }


    // Reset fields
    setQty('');
    if (!isProductLocked) {
      setSelectedProductId('');
      setRate('');
    }
    productInputRef.current?.focus();
  };
  
  const handleItemUpdate = (itemId: number, field: 'rate' | 'qty', value: string) => {
    const updatedItems = billItems.map(item => {
      if (item.id === itemId) {
        let newQty = item.qty;
        let newRate = item.rate;
        if (field === 'rate') {
            newRate = parseFloat(value) || 0;
        }
        if (field === 'qty') {
            newQty = parseFloat(value) || 0;
        }
        return { ...item, qty: newQty, rate: newRate, amount: newQty * newRate };
      }
      return item;
    });
    setBillItems(updatedItems);
    
    // Auto-save on update
    const customer = customers.find(c => c.id === selectedCustomerId);
    if(customer && activeBillNo) {
        const newBillSummary = {
            customerName: `${customer.name_en} (${customer.name_ta})`,
            createdBy: currentUser?.username || 'N/A',
            stall: '1',
            date: date || new Date(),
        };
        createOrUpdateLiveBill(newBillSummary, updatedItems, parseFloat(paidAmount) || 0, activeBillNo);
    }
  };


  const handleRemoveItem = (itemId: number) => {
    showAlertDialog({
        title: "Delete Item?",
        description: "Are you sure you want to remove this item from the bill? This cannot be undone.",
        onConfirm: () => {
            const itemToRemove = billItems.find(item => item.id === itemId);
            if (!itemToRemove || !activeBillNo) return;

            removeBillItem(itemId, activeBillNo);
            setBillItems(prev => prev.filter(item => item.id !== itemId));
            toast({
                title: "Item Removed",
                description: "The item has been removed from the bill.",
            });
        }
    });
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
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer || (billItems.length === 0 && !activeBillNo)) {
      toast({
        variant: 'destructive',
        title: 'Cannot Save Bill',
        description:
          'A customer must be selected and at least one item must be added.',
      });
      return;
    }

    const newBillSummary = {
      customerName: `${customer.name_en} (${customer.name_ta})`,
      createdBy: currentUser?.username || 'N/A', // Should be dynamic
      stall: '1', // Should be dynamic
      date: date || new Date(),
    };

    const paidAmountNum = parseFloat(paidAmount) || 0;

    const billNo = createOrUpdateLiveBill(
      newBillSummary,
      billItems,
      paidAmountNum,
      activeBillNo
    );

    if (activeBillNo) {
      toast({
        title: 'Bill Updated',
        description: `Bill ${billNo} has been successfully updated.`,
      });
    } else {
      toast({
        title: 'Bill Saved',
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

  const totalAmount = useMemo(
    () => billItems.reduce((sum, item) => sum + item.amount, 0),
    [billItems]
  );

  const previousBalance = useMemo(() => {
    if (!selectedCustomerId) return 0;
    // When loading an existing bill, the `initialBillTotal` is part of the customer's balance already.
    // We subtract it to show the balance *before* this bill was created/loaded.
    return (customerBalances[selectedCustomerId] || 0) - initialBillTotal;
  }, [selectedCustomerId, customerBalances, initialBillTotal]);

  const finalBalance =
    previousBalance + totalAmount - (parseFloat(paidAmount) || 0);

  const selectedCustomerData = customers.find(
    (c) => c.id.toLowerCase() === selectedCustomerId.toLowerCase()
  );
  const selectedProductData = products.find(
    (p) => p.id.toLowerCase() === selectedProductId.toLowerCase()
  );

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((p) => p.id === productId);
    if (product && product.uom_allowed.length > 0) {
      setUom(product.uom_allowed[0]);
    }
    setProductPopoverOpen(false);
  };

  const handleCustomerSelect = (customerId: string) => {
      if (customerId !== selectedCustomerId) {
        router.replace('/dashboard'); // Clear any billNo from params
        setSelectedCustomerId(customerId);
      }
      setCustomerPopoverOpen(false);
  };

  return (
    <div className="grid auto-rows-max items-start gap-4 lg:gap-8 lg:grid-cols-2">
      <div className="grid gap-4">
        {/* Left Column: Inputs */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-start">
            <div>
              <CardTitle className="font-headline">
                {activeBillNo
                  ? `Editing Bill ${activeBillNo}`
                  : 'Create Bill'}
              </CardTitle>
              <CardDescription>
                Select customer, add products, and generate a bill.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-[240px] justify-start text-left font-normal',
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
                 <Button variant="outline" onClick={handleNewBill}>
                    <FilePlus className="mr-2 h-4 w-4" />
                    New Bill
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
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
                              value={`${customer.name_en} ${customer.name_ta} ${customer.id}`}
                              onSelect={() => handleCustomerSelect(customer.id)}
                              onClick={() => handleCustomerSelect(customer.id)}
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
            <div className="grid gap-4 grid-cols-12 items-end">
              <div className="grid gap-2 col-span-12 lg:col-span-5">
                <Label htmlFor="product">Product (ID, பெயர், Name)</Label>
                <div className="relative">
                   <Popover
                      open={productPopoverOpen}
                      onOpenChange={setProductPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          ref={productInputRef}
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
                                  value={`${product.name_en} ${product.name_ta} ${product.id}`}
                                  onSelect={() => handleProductSelect(product.id)}
                                  onClick={() => handleProductSelect(product.id)}
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
              <div className="grid gap-2 col-span-4 lg:col-span-2">
                <Label htmlFor="uom">UOM</Label>
                <Select
                  value={uom}
                  onValueChange={setUom}
                  disabled={!selectedProductData}
                >
                  <SelectTrigger id="uom">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProductData?.uom_allowed.map((uom) => (
                      <SelectItem key={uom} value={uom}>
                        {uom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 col-span-4 lg:col-span-2">
                <Label htmlFor="qty">Qty</Label>
                <Input
                  id="qty"
                  type="number"
                  placeholder="0.00"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  disabled={!selectedCustomerId}
                />
              </div>
              <div className="grid gap-2 col-span-4 lg:col-span-2">
                <Label htmlFor="rate">Rate (₹)</Label>
                <Input
                  id="rate"
                  type="number"
                  placeholder="0.00"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  disabled={!selectedCustomerId}
                />
              </div>
              <div className="col-span-12 lg:col-span-1">
                <Button
                  onClick={handleAddItem}
                  className="w-full"
                  size="sm"
                  disabled={!selectedCustomerId}
                >
                  <PlusCircle className="h-4 w-4 md:mr-2" />
                  <span className="sr-only md:not-sr-only">Add</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        {/* Right Column: Bill Items and Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Current Bill</CardTitle>
            <CardDescription>
              {selectedCustomerId
                ? `Items added for ${selectedCustomerData?.name_en}.`
                : 'Select a customer to view or create a bill.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[40vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">S/N</TableHead>
                  <TableHead>Product (பெயர்)</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right w-40">Rate (₹)</TableHead>
                  <TableHead className="text-right">Amount (₹)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billItems.length > 0 ? (
                  billItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {item.product}
                      </TableCell>
                      <TableCell>{item.uom}</TableCell>
                      <TableCell className="text-right">
                        {item.qty.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right">
                         <Input
                            type="number"
                            value={item.rate.toFixed(2)}
                            onChange={(e) => handleItemUpdate(item.id, 'rate', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="h-8 text-right w-24 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {item.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete item</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center h-24">
                      {selectedCustomerId
                        ? 'No items added yet.'
                        : 'Select a customer to begin.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          {selectedCustomerId && (
            <CardFooter className="flex flex-col items-end gap-4 pt-4">
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
                <span className="font-bold font-mono">
                  ₹{finalBalance.toFixed(2)}
                </span>
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
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
