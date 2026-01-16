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
import { BillItem, Customer } from '@/lib/data';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import ReactSelect from 'react-select';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, writeBatch, Timestamp } from 'firebase/firestore';

interface BillPrintData {
  billNo: string;
  date: string;
  customer: Customer;
  items: BillItem[];
  totalAmount: number;
  previousBalance: number;
  paidAmount: number;
  finalBalance: number;
  stall: string;
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();
  const firestore = useFirestore();

  const {
    customers,
    products,
    productPrices,
    customerBalances,
    currentUser,
    findBillForCustomerToday,
    createOrUpdateLiveBill,
    removeBillItem,
    getBill,
  } = useData();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isProductLocked, setIsProductLocked] = useState(false);
  const [activeBillNo, setActiveBillNo] = useState<string | null>(null);
  const [initialBillTotal, setInitialBillTotal] = useState(0);

  // Form state for new item
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [uom, setUom] = useState('KGS');
  const [paidAmount, setPaidAmount] = useState('');

  // --- Reactive Bill Items from Firestore ---
  const billItemsQuery = useMemoFirebase(() => {
    if (!firestore || !activeBillNo) return null;
    return collection(firestore, 'bills', activeBillNo, 'billItems');
  }, [firestore, activeBillNo]);
  const { data: billItems } = useCollection<BillItem>(billItemsQuery);


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
          setInitialBillTotal(billToEdit.amount);
          setPaidAmount('');

          const dateFromBill = billToEdit.date;
          if (dateFromBill) {
            setDate(dateFromBill instanceof Timestamp ? dateFromBill.toDate() : new Date(dateFromBill));
          } else {
             setDate(new Date());
          }
        }
      }
    }
  }, [searchParams, customers, getBill]);

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
        setInitialBillTotal(existingBill.amount);
      } else {
        setActiveBillNo(null);
        setInitialBillTotal(0);
      }
      setPaidAmount('');
    }
  }, [selectedCustomerId, findBillForCustomerToday, searchParams]);

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

    const newItem: Omit<BillItem, 'id'> = {
      product: productInfo.name_ta,
      productId: productInfo.id,
      uom: uom,
      qty: qtyNum,
      rate: rateNum,
      amount: qtyNum * rateNum,
      addedBy: currentUser?.id || 'unknown-user',
      stall: '1', 
    };

    const customer = customers.find(c => c.id === selectedCustomerId);
    if (customer) {
      const currentItems = billItems || [];
      const newBillItems = [...currentItems, {...newItem, id: Date.now().toString()}];
      const newBillSummary = {
        customerName: `${customer.name_en} (${customer.name_ta})`,
        createdBy: currentUser?.id || 'unknown-user',
        stall: '1',
        date: date || new Date(),
        customerId: selectedCustomerId,
      };

      const { billNo } = createOrUpdateLiveBill(newBillSummary, newBillItems, parseFloat(paidAmount) || 0, activeBillNo);

      if (!activeBillNo) {
        setActiveBillNo(billNo);
      }
    }

    setQty('');
    if (!isProductLocked) {
      setSelectedProductId('');
      setRate('');
    }

    productSelectRef.current?.focus();
  };

  const persistItemUpdate = (itemId: string, field: 'rate' | 'qty', value: string) => {
    const itemToUpdate = billItems?.find(item => item.id === itemId);
    if (!itemToUpdate || !activeBillNo || !firestore) return;

    const parsedValue = parseFloat(value) || 0;
    const newQty = field === 'qty' ? parsedValue : itemToUpdate.qty;
    const newRate = field === 'rate' ? parsedValue : itemToUpdate.rate;
    const newAmount = newQty * newRate;

    const updateData = {
      [field]: parsedValue,
      amount: newAmount,
    };

    const batch = writeBatch(firestore);

    const itemRef = doc(firestore, 'bills', activeBillNo, 'billItems', itemId);
    batch.update(itemRef, updateData);

    const newTotalAmount = (billItems || []).reduce((sum, item) => {
      if (item.id === itemId) return sum + newAmount;
      return sum + item.amount;
    }, 0);

    const billRef = doc(firestore, 'bills', activeBillNo);
    batch.update(billRef, { amount: newTotalAmount });

    batch.commit().catch(error => {
      console.error("Failed to update item:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not save item changes."
      });
    });
  };

  const handleRemoveItem = (itemId: string) => {
    showAlertDialog({
      title: "Delete Item?",
      description: "Are you sure you want to remove this item from the bill? This cannot be undone.",
      onConfirm: () => {
        if (!activeBillNo || !firestore) return;

        const batch = writeBatch(firestore);
        const itemRef = doc(firestore, 'bills', activeBillNo, 'billItems', itemId);
        batch.delete(itemRef);

        const remainingItems = billItems?.filter(i => i.id !== itemId) || [];
        const newTotalAmount = remainingItems.reduce((sum, item) => sum + item.amount, 0);
        const billRef = doc(firestore, 'bills', activeBillNo);
        batch.update(billRef, { amount: newTotalAmount });

        batch.commit().then(() => {
          toast({
            title: "Item Removed",
            description: "The item has been removed from the bill.",
          });
        }).catch(error => {
          console.error("Failed to delete item:", error);
          toast({
            variant: "destructive",
            title: "Delete Failed",
            description: "Could not remove the item."
          });
        });
      }
    });
  };

  const handleNewBill = () => {
    setSelectedCustomerId('');
    setActiveBillNo(null);
    setDate(new Date());
    setSelectedProductId('');
    setQty('');
    setRate('');
    setPaidAmount('');
    setInitialBillTotal(0);
    router.replace('/dashboard');
  };

  const handleSaveAndGetData = async (): Promise<BillPrintData | null> => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const currentItems = billItems || [];

    if (!customer) {
        toast({
            variant: 'destructive',
            title: 'Cannot Save Bill',
            description: 'A customer must be selected.',
        });
        return null;
    }
    
    if (currentItems.length === 0) {
      if (activeBillNo) {
        // If it's an existing bill with all items deleted, allow saving (which will result in a 0 amount bill)
      } else {
        toast({
          variant: 'destructive',
          title: 'Cannot Save Bill',
          description: 'Please add at least one item for a new bill.',
        });
        return null;
      }
    }


    const billSummary = {
        customerName: `${customer.name_en} (${customer.name_ta})`,
        createdBy: currentUser?.id || 'unknown-user',
        stall: '1',
        date: date || new Date(),
        customerId: selectedCustomerId,
    };

    const paidAmountNum = parseFloat(paidAmount) || 0;

    const { billNo, commitPromise } = createOrUpdateLiveBill(
        billSummary,
        currentItems,
        paidAmountNum,
        activeBillNo
    );

    try {
        await commitPromise;

        toast({
            title: activeBillNo ? 'Bill Updated' : 'Bill Saved',
            description: `Bill ${billNo} has been successfully saved.`,
        });
        
        if (!activeBillNo) {
            setActiveBillNo(billNo);
        }

        const finalTotalAmount = currentItems.reduce((sum, item) => sum + item.amount, 0);
        const finalPreviousBalance = (customerBalances[selectedCustomerId] || 0) - (activeBillNo ? initialBillTotal : 0);
        const finalFinalBalance = finalPreviousBalance + finalTotalAmount - paidAmountNum;
        
        return {
            billNo,
            date: date?.toISOString() || new Date().toISOString(),
            customer: customer,
            items: currentItems,
            totalAmount: finalTotalAmount,
            previousBalance: finalPreviousBalance,
            paidAmount: paidAmountNum,
            finalBalance: finalFinalBalance,
            stall: '1',
        };
    } catch (error) {
        console.error('Save failed:', error);
        toast({
          variant: "destructive",
          title: "Save failed",
          description: "There was an issue saving the bill."
        })
        return null;
    }
  };
  
  const handleSaveBill = async () => {
    const savedData = await handleSaveAndGetData();
    if (savedData) {
        handleNewBill();
    }
  };

  const handlePrintBill = async (paper: 'thermal' | 'a4') => {
    const billData = await handleSaveAndGetData();

    if (billData) {
        const encodedData = encodeURIComponent(JSON.stringify(billData));
        window.open(
          `/dashboard/print?data=${encodedData}&paper=${paper}`,
          '_blank'
        );
    }
  };


  const totalAmount = useMemo(
    () => (billItems || []).reduce((sum, item) => sum + item.amount, 0),
    [billItems]
  );

  const previousBalance = useMemo(() => {
    if (!selectedCustomerId) return 0;
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

  const productSelectRef = useRef<any>(null);

  const handleCustomerSelect = (customerId: string) => {
    router.replace('/dashboard');
    setSelectedCustomerId(customerId);
  };


  return (
    <div className="grid auto-rows-max items-start gap-4 lg:gap-8 lg:grid-cols-2">
      <div className="grid gap-4">
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

                <ReactSelect
                  instanceId="customer-select"
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
                    router.replace('/dashboard');
                    setSelectedCustomerId(option ? option.value : '');
                    handleCustomerSelect(option ? option.value : '')
                  }}
                  styles={{
                    menu: (base) => ({ ...base, zIndex: 50 }),
                  }}
                />

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
            <div className="flex flex-wrap items-end gap-4">
              <div className="grid gap-2 flex-grow-[3] basis-72">
                <Label htmlFor="product">Product (ID, பெயர், Name)</Label>
                <div className="relative">
                  <ReactSelect
                    instanceId="product-select"
                    placeholder="Select product..."
                    isClearable
                    isDisabled={!selectedCustomerId || isProductLocked}
                    options={products.map((p) => ({
                      value: p.id,
                      label: `${p.name_en} (${p.name_ta})`,
                    }))}
                    value={
                      selectedProductData
                        ? {
                          value: selectedProductData.id,
                          label: `${selectedProductData.name_en} (${selectedProductData.name_ta})`,
                        }
                        : null
                    }
                    onChange={(option) => {
                      if (!option) {
                        setSelectedProductId('');
                        setRate('');
                        return;
                      }

                      setSelectedProductId(option.value);

                      const product = products.find((p) => p.id === option.value);
                      if (product && product.uom_allowed.length > 0) {
                        setUom(product.uom_allowed[0]);
                      }
                    }}
                    styles={{
                      menu: (base) => ({ ...base, zIndex: 50 }),
                    }}
                    filterOption={(option, input) =>
                      option.label.toLowerCase().includes(input.toLowerCase()) ||
                      option.value.toLowerCase().includes(input.toLowerCase())
                    }
                    ref={productSelectRef}
                  />
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
              <div className="grid gap-2 flex-grow-[1] basis-28">
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
              <div className="grid gap-2 flex-grow-[1] basis-28">
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
              <div className="grid gap-2 flex-grow-[1] basis-28">
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
              <div className='flex-grow-[1] basis-16'>
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
                {billItems && billItems.length > 0 ? (
                  billItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-medium">
                        {item.product}
                      </TableCell>
                      <TableCell>{item.uom}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          defaultValue={item.qty}
                          onBlur={(e) => persistItemUpdate(item.id, 'qty', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className="h-8 text-right w-24 ml-auto"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          defaultValue={item.rate}
                          onBlur={(e) => persistItemUpdate(item.id, 'rate', e.target.value)}
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
            <CardFooter className="flex flex-col items-stretch sm:items-end gap-4 pt-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-right text-lg w-full max-w-md self-end">
                <span className="font-semibold">Total:</span>
                <span className="font-bold font-mono">
                  ₹{totalAmount.toFixed(2)}
                </span>
                <span className="font-semibold">Prev Balance:</span>
                <span className="font-mono">₹{previousBalance.toFixed(2)}</span>
                <span className="font-semibold">Paid:</span>
                <Input
                  className="max-w-32 text-right font-mono ml-auto"
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
                <span className="font-semibold">Balance:</span>
                <span className="font-bold font-mono">
                  ₹{finalBalance.toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="lg" variant="outline" onClick={handleSaveBill}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Bill
                </Button>
                <Button onClick={() => handlePrintBill('thermal')}>
                  Print Receipt (79mm)
                </Button>

                <Button variant="outline" onClick={() => handlePrintBill('a4')}>
                  Print A4
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
