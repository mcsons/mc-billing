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
  Save,
  Trash2,
  MoreVertical,
  Share,
} from 'lucide-react';
import { BillItem, Customer } from '@/lib/data';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import ReactSelect from 'react-select';
import {
  collection,
  doc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';

interface BillPrintData {
  billNo: string;
  date: string;
  customer: Customer;
  items: BillItem[];
  itemsTotal: number;
  deliveryCharge: number;
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
    getBill,
    liveBillSummaries
  } = useData();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [customerSearchText, setCustomerSearchText] = useState('');
  const [isProductLocked, setIsProductLocked] = useState(false);
  const [activeBillNo, setActiveBillNo] = useState<string | null>(null);
  const [initialBillTotal, setInitialBillTotal] = useState(0);

  // Form state for new item
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [uom, setUom] = useState('KGS');
  const [paidAmount, setPaidAmount] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  
  // Print confirmation dialog state
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [printPaperType, setPrintPaperType] = useState<'a4' | 'thermal'>('thermal');

  const [walkInConfirmed, setWalkInConfirmed] = useState(false);

  // WhatsApp share state
  const [showWhatsAppShareConfirm, setShowWhatsAppShareConfirm] = useState(false);


  // Refs for keyboard navigation
  const customerSelectRef = useRef<any>(null);
  const productSelectRef = useRef<any>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const rateInputRef = useRef<HTMLInputElement>(null);
  const uomTriggerRef = useRef<HTMLButtonElement>(null);
  const billItemsContainerRef = useRef<HTMLDivElement>(null);
  const initializationPathRef = useRef<string | null>(null);


  // --- Reactive Bill Items from Firestore ---
  const billItemsQuery = useMemoFirebase(() => {
    if (!firestore || !activeBillNo) return null;
    return collection(firestore, 'bills', activeBillNo, 'billItems');
  }, [firestore, activeBillNo]);
  const { data: billItems, isLoading: isBillItemsLoading } = useCollection<BillItem>(billItemsQuery);

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
  
  useEffect(() => {
    customerSelectRef.current?.focus();
  }, []);

  // Centralized Effect for State Initialization and Customer Changes
  useEffect(() => {
    const billNoFromParams = searchParams.get('billNo');
    const pathKey = `${selectedCustomerId}-${billNoFromParams}`;
    
    // Safety check: If we've already initialized for this path, or if we have an active bill 
    // that matches the current selection, don't reset. This protects ongoing billing (adding items).
    if (initializationPathRef.current === pathKey) {
        return;
    }
    
    // Case 1: Editing a specific bill via URL parameter
    if (billNoFromParams) {
      const billToEdit = getBill(billNoFromParams);
      if (billToEdit) {
        initializationPathRef.current = pathKey;
        if (billToEdit.customerId !== selectedCustomerId) {
          setSelectedCustomerId(billToEdit.customerId === 'WALK-IN' ? '' : billToEdit.customerId);
        }
        setActiveBillNo(billToEdit.billNo);
        setInitialBillTotal(billToEdit.amount);
        setDeliveryCharge(billToEdit.deliveryCharge?.toString() || '');
        setPaidAmount('');

        if (billToEdit.date) {
          setDate(billToEdit.date instanceof Timestamp ? billToEdit.date.toDate() : new Date(billToEdit.date));
        }
        return; 
      }
    }

    // Case 2: Selected a specific customer (not in edit mode from URL)
    if (selectedCustomerId) {
      const existingBill = findBillForCustomerToday(selectedCustomerId);
      initializationPathRef.current = pathKey;
      if (existingBill) {
        setActiveBillNo(existingBill.billNo);
        setInitialBillTotal(existingBill.amount);
        setDeliveryCharge(existingBill.deliveryCharge?.toString() || '');
      } else {
        setActiveBillNo(null);
        setInitialBillTotal(0);
        setDeliveryCharge('');
      }
      setPaidAmount('');
      return;
    }

    // Case 3: Walk-in Customer (selectedCustomerId is empty)
    // Only clear if we don't already have an active bill number we are working on
    if (!activeBillNo) {
        initializationPathRef.current = pathKey;
        setActiveBillNo(null);
        setInitialBillTotal(0);
        setDeliveryCharge('');
        setPaidAmount('');
        setDate(new Date());
    }

  }, [selectedCustomerId, searchParams, getBill, findBillForCustomerToday, activeBillNo]);

  useEffect(() => {
    if (selectedProductId && uom) {
      const price = productPrices[selectedProductId]?.[uom];
      if (price !== undefined && price !== null) {
        setRate(price.toString());
      } else {
        setRate('1');
      }
    } else {
      setRate('');
    }
  }, [selectedProductId, uom, productPrices]);

  useEffect(() => {
    if (billItemsContainerRef.current) {
        const { scrollHeight } = billItemsContainerRef.current;
        billItemsContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
    }
  }, [billItems]);

  const handleAddItem = useCallback(() => {
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

    const newItem: Omit<BillItem, 'id' | 'billId'> = {
      product: productInfo.name_ta,
      productId: productInfo.id,
      uom: uom,
      qty: qtyNum,
      rate: rateNum,
      amount: qtyNum * rateNum,
      addedBy: currentUser?.id || 'unknown-user',
      stall: '1',
    };

    const customer = customers.find((c) => c.id === selectedCustomerId);
    
    const summaryCustomerId = customer ? customer.id : 'WALK-IN';
    const summaryCustomerName = customer ? `${customer.name_en} (${customer.name_ta})` : 'Walk-in Customer';

    const currentItems = billItems || [];
    const newBillItems = [
        ...currentItems,
        { ...newItem, id: Date.now().toString() },
    ];
    const billSummary = {
        customerName: summaryCustomerName,
        customerId: summaryCustomerId,
        stall: '1',
    };

    const { billNo, commitPromise } = createOrUpdateLiveBill(
        billSummary,
        newBillItems,
        parseFloat(paidAmount) || 0,
        parseFloat(deliveryCharge) || 0,
        date || new Date(),
        activeBillNo
    );

    if (!activeBillNo) {
        setActiveBillNo(billNo);
    }

    setQty('');
    setRate('');
    
    // Clear the selection in ReactSelect
    if (productSelectRef.current) {
        productSelectRef.current.clearValue();
    }
    // Explicitly set productId to empty and focus
    setSelectedProductId('');
    productSelectRef.current?.focus();

}, [selectedCustomerId, selectedProductId, qty, rate, uom, currentUser, customers, billItems, date, activeBillNo, products, createOrUpdateLiveBill, paidAmount, deliveryCharge, toast]);


  const persistItemUpdate = (
    itemId: string,
    field: 'rate' | 'qty',
    value: string
  ) => {
    const itemToUpdate = billItems?.find((item) => item.id === itemId);
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

    const newItemsTotal = (billItems || []).reduce((sum, item) => {
      if (item.id === itemId) return sum + newAmount;
      return sum + item.amount;
    }, 0);
    const newBillTotal = newItemsTotal + (parseFloat(deliveryCharge) || 0);


    const billRef = doc(firestore, 'bills', activeBillNo);
    batch.update(billRef, { amount: newBillTotal });

    batch.commit().catch((error) => {
      console.error('Failed to update item:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not save item changes.',
      });
    });
  };

  const handleRemoveItem = (itemId: string) => {
    const itemToDelete = billItems?.find((i) => i.id === itemId);
    if (!itemToDelete || !activeBillNo || !firestore) return;

    showAlertDialog({
      title: 'Delete Item?',
      description:
        'Are you sure you want to remove this item from the bill? This cannot be undone.',
      onConfirm: () => {
        const batch = writeBatch(firestore);
        const itemRef = doc(
          firestore,
          'bills',
          activeBillNo,
          'billItems',
          itemId
        );
        batch.delete(itemRef);

        const remainingItems = billItems?.filter((i) => i.id !== itemId) || [];
        const newItemsTotal = remainingItems.reduce(
          (sum, item) => sum + item.amount,
          0
        );
        const newBillTotal = newItemsTotal + (parseFloat(deliveryCharge) || 0);

        const billRef = doc(firestore, 'bills', activeBillNo);
        batch.update(billRef, { amount: newBillTotal });

        batch
          .commit()
          .then(() => {
            toast({
              title: 'Item Removed',
              description: 'The item has been removed.',
              duration: 10000,
              action: (
                <ToastAction altText="Undo" onClick={() => {
                  const undoBatch = writeBatch(firestore);
                  undoBatch.set(itemRef, itemToDelete);
                  // Recalculate bill total with restored item
                  const restoredItemsTotal = remainingItems.reduce((sum, item) => sum + item.amount, 0) + itemToDelete.amount;
                  const restoredBillTotal = restoredItemsTotal + (parseFloat(deliveryCharge) || 0);
                  undoBatch.update(billRef, { amount: restoredBillTotal });
                  undoBatch.commit().then(() => {
                    toast({ title: 'Item restored' });
                  });
                }}>Undo</ToastAction>
              )
            });
          })
          .catch((error) => {
            console.error('Failed to delete item:', error);
            toast({
              variant: 'destructive',
              title: 'Delete Failed',
              description: 'Could not remove the item.',
            });
          });
      },
    });
  };

  /**
   * Resets the entire billing form to its initial fresh state.
   * This is a silent reset used after successful save or when confirmed by user.
   */
  const performReset = useCallback(() => {
    initializationPathRef.current = null;
    setSelectedCustomerId('');
    setActiveBillNo(null);
    setDate(new Date());
    setSelectedProductId('');
    setQty('');
    setRate('');
    setPaidAmount('');
    setDeliveryCharge('');
    setInitialBillTotal(0);
    setWalkInConfirmed(false);
    
    // Clear product selection UI
    if (productSelectRef.current) {
      productSelectRef.current.clearValue();
    }
    
    // Reset routing and focus
    router.replace('/dashboard/billing');
    setTimeout(() => {
      customerSelectRef.current?.focus();
    }, 50);
  }, [router]);

  /**
   * Handles the "New Bill" button click with unsaved changes protection.
   */
  const handleNewBill = useCallback(() => {
    // Detect if any data has been entered or a bill is active
    const hasChanges = 
      selectedCustomerId !== '' || 
      (billItems && billItems.length > 0) || 
      qty !== '' || 
      rate !== '' || 
      paidAmount !== '' || 
      deliveryCharge !== '' ||
      activeBillNo !== null;

    if (hasChanges) {
      showAlertDialog({
        title: 'Unsaved Changes',
        description: 'You have unsaved changes. Are you sure you want to create a new bill?',
        confirmText: 'Yes, Discard and Start New',
        cancelText: 'Cancel',
        onConfirm: performReset,
      });
    } else {
      performReset();
    }
  }, [selectedCustomerId, billItems, qty, rate, paidAmount, deliveryCharge, activeBillNo, showAlertDialog, performReset]);

  const handleSaveAndGetData = async (): Promise<BillPrintData | null> => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const currentItems = billItems || [];

    if (currentItems.length === 0 && !activeBillNo) {
      toast({
        variant: 'destructive',
        title: 'Cannot Save Bill',
        description: 'Please add at least one item for a new bill.',
      });
      return null;
    }
    
    if (!customer && selectedCustomerId) {
        toast({
            variant: 'destructive',
            title: 'Customer Not Found',
            description: 'The selected customer ID is invalid.',
        });
        return null;
    }

    const billSummary = {
      customerName: customer ? `${customer.name_en} (${customer.name_ta})` : 'Walk-in Customer',
      customerId: selectedCustomerId || 'WALK-IN',
      stall: '1',
    };
    
    const paidAmountNum = parseFloat(paidAmount) || 0;
    const deliveryChargeNum = parseFloat(deliveryCharge) || 0;

    const { billNo, commitPromise } = createOrUpdateLiveBill(
      billSummary,
      currentItems,
      paidAmountNum,
      deliveryChargeNum,
      date || new Date(),
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

      return getBillPrintData();
    } catch (error) {
      console.error('Save failed:', error);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'There was an issue saving the bill.',
      });
      return null;
    }
  };

  const getBillPrintData = useCallback((): BillPrintData | null => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const currentItems = billItems || [];

    if (currentItems.length === 0 && !activeBillNo) {
      toast({
        variant: 'destructive',
        title: 'Cannot Get Bill Data',
        description: 'Please add at least one item.',
      });
      return null;
    }

    const deliveryChargeNum = parseFloat(deliveryCharge) || 0;
    const paidAmountNum = parseFloat(paidAmount) || 0;
    
    const finalItemsTotal = currentItems.reduce(
        (sum, item) => sum + item.amount, 0
    );
    const finalTotalAmount = finalItemsTotal + deliveryChargeNum;
      
    const finalPreviousBalance =
        (customerBalances[selectedCustomerId] || 0) - (activeBillNo ? initialBillTotal : 0);

    const finalFinalBalance =
        finalPreviousBalance + finalTotalAmount - paidAmountNum;

    const printCustomer = customer || { id: 'WALK-IN', name_en: '-', name_ta: '-', phone: '-' };

    const billNo = activeBillNo || (() => {
        const maxBillNo = (liveBillSummaries || [])
            .map(b => parseInt(b.billNo.replace('B', ''), 10))
            .filter(num => !isNaN(num))
            .reduce((max, num) => Math.max(max, num), 1237);
        return `B${maxBillNo + 1}`;
    })();

    return {
        billNo,
        date: date?.toISOString() || new Date().toISOString(),
        customer: printCustomer as Customer,
        items: currentItems,
        itemsTotal: finalItemsTotal,
        deliveryCharge: deliveryChargeNum,
        totalAmount: finalTotalAmount,
        previousBalance: finalPreviousBalance,
        paidAmount: paidAmountNum,
        finalBalance: finalFinalBalance,
        stall: '1'
    };
  }, [customers, selectedCustomerId, billItems, activeBillNo, deliveryCharge, paidAmount, customerBalances, initialBillTotal, date, liveBillSummaries]);


  const handleSaveBill = async () => {
    // Only allow saving if a customer is selected
    if (!selectedCustomerId) {
        toast({ variant: 'destructive', title: 'Customer Required', description: 'Please select a customer to save the bill.' });
        return;
    }
    const savedData = await handleSaveAndGetData();
    if (savedData) {
      performReset();
    }
  };

  const proceedToPrint = (billData: BillPrintData | null) => {
    if (billData) {
        const encodedData = encodeURIComponent(JSON.stringify(billData));
        window.open(`/print/bill?data=${encodedData}&paper=${printPaperType}`, '_blank');
    }
  };

  const handleSaveAndPrintConfirm = async () => {
      // "Save & Print" should only work if a customer is selected.
      if (!selectedCustomerId) {
          toast({ variant: 'destructive', title: 'Customer Required', description: 'Please select a customer to save and print.' });
          return;
      }
      const savedData = await handleSaveAndGetData();
      if (savedData) {
        proceedToPrint(savedData);
        performReset();
      }
      setShowPrintConfirm(false);
  };
  
  const handlePrintWithoutSavingConfirm = () => {
      const billData = getBillPrintData();
      proceedToPrint(billData);
      setShowPrintConfirm(false);
  };
  
  const handlePrintBill = async (paper: 'thermal' | 'a4') => {
    const currentItems = billItems || [];
    if (currentItems.length === 0 && !activeBillNo) {
        toast({
            variant: 'destructive',
            title: 'Cannot Print',
            description: 'Please add at least one item to the bill.',
        });
        return;
    }
    setPrintPaperType(paper);
    setShowPrintConfirm(true);
  };

  const handleShareWhatsApp = async () => {
    const currentItems = billItems || [];
    if (currentItems.length === 0 && !activeBillNo) {
        toast({
            variant: 'destructive',
            title: 'Cannot Share',
            description: 'Please add at least one item to the bill.',
        });
        return;
    }
    
    // Logic updated: Only show confirmation dialog, don't auto-open preview tab
    setShowWhatsAppShareConfirm(true);
  };

  const confirmOpenWhatsApp = () => {
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const currentItems = billItems || [];
    const phone = customer?.phone || '';
    
    const itemsTotal = currentItems.reduce((sum, item) => sum + item.amount, 0);
    const delCharge = parseFloat(deliveryCharge) || 0;
    const billTot = itemsTotal + delCharge;
    const prevBal = (customerBalances[selectedCustomerId] || 0) - (activeBillNo ? initialBillTotal : 0);
    const paid = parseFloat(paidAmount) || 0;
    const finalBal = prevBal + billTot - paid;
    
    const customerName = customer ? `${customer.name_en} (${customer.name_ta})` : 'Walk-in Customer';
    const formattedDate = format(date || new Date(), 'dd-MM-yyyy');
    const billDisplayNo = activeBillNo || 'New Bill';

    let message = `*M.C & SONS FISH COMPANY*\n`;
    message += `*BILL SUMMARY*\n`;
    message += `Bill No: ${billDisplayNo}\n`;
    message += `Date: ${formattedDate}\n`;
    message += `Customer: ${customerName}\n`;
    message += `-------------------------\n`;
    
    currentItems.forEach((item, index) => {
        message += `${index + 1}. ${item.product} (${item.qty} ${item.uom} x ${item.rate}) = ₹${item.amount.toFixed(2)}\n`;
    });
    
    message += `-------------------------\n`;
    message += `Items Total: ₹${itemsTotal.toFixed(2)}\n`;
    if (delCharge > 0) message += `Delivery: ₹${delCharge.toFixed(2)}\n`;
    message += `*Bill Total: ₹${billTot.toFixed(2)}*\n`;
    message += `Prev Bal: ₹${prevBal.toFixed(2)}\n`;
    message += `Paid: ₹${paid.toFixed(2)}\n`;
    message += `*Final Bal: ₹${finalBal.toFixed(2)}*\n`;
    message += `-------------------------\n`;
    message += `Thank you for your business!`;

    const encodedMsg = encodeURIComponent(message);
    
    const whatsappUrl = phone 
        ? `https://wa.me/${phone}?text=${encodedMsg}` 
        : `https://wa.me/?text=${encodedMsg}`;
        
    window.open(whatsappUrl, '_blank');
    setShowWhatsAppShareConfirm(false);
  };

  const itemsTotal = useMemo(
    () => (billItems || []).reduce((sum, item) => sum + item.amount, 0),
    [billItems]
  );
  const totalAmount = itemsTotal + (parseFloat(deliveryCharge) || 0);


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

  const handleCustomerSelect = (customerId: string) => {
    initializationPathRef.current = null;
    router.replace('/dashboard/billing');
    setSelectedCustomerId(customerId);
  };
  
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      rateInputRef.current?.focus();
    }
  };
  
  const handleRateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    // Only trigger walk-in confirmation if TAB is pressed, no customer is selected, 
    // AND the search box is entirely empty.
    if (e.key === 'Tab' && !e.shiftKey && !selectedCustomerId && !customerSearchText && !walkInConfirmed) {
      e.preventDefault(); 
      showAlertDialog({
        title: 'Confirm Walk-In Customer',
        description:
          'Are you sure you want to create this bill as a Walk-In customer without selecting a customer name?',
        confirmText: 'Yes, Continue as Walk-In',
        cancelText: 'No, Select Customer',
        onConfirm: () => {
          setWalkInConfirmed(true);
          setTimeout(() => productSelectRef.current?.focus(), 50);
        },
        onCancel: () => {
          setTimeout(() => customerSelectRef.current?.focus(), 50);
        },
      });
    }
  };

  return (
    <div className="relative">
      <div className="grid auto-rows-max items-start gap-4 pb-24 md:pb-4 lg:grid-cols-2 lg:gap-8">
        <div className="grid auto-rows-max gap-4">
          <Card>
            <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between pb-2">
              <div>
                <CardTitle className="font-headline">
                  {activeBillNo ? `Editing Bill ${activeBillNo}` : 'Create Bill'}
                </CardTitle>
                <CardDescription>
                  Manage active transaction.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal sm:w-[240px]',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'dd-MM-yyyy') : <span>Pick a date</span>}
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
              <div className="grid gap-2">
                <Label htmlFor="customer">Customer</Label>
                <ReactSelect
                  ref={customerSelectRef}
                  instanceId="customer-select"
                  placeholder="Select customer or leave blank for walk-in..."
                  isClearable
                  tabSelectsValue={true}
                  onInputChange={(val) => setCustomerSearchText(val)}
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
                    const customerId = option ? option.value : '';
                    handleCustomerSelect(customerId);
                    if (!customerId) {
                      setWalkInConfirmed(false);
                    }
                  }}
                  onKeyDown={handleCustomerKeyDown}
                  styles={reactSelectStyles}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-headline text-lg">Add Item</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-nowrap items-end gap-3">
                <div className="grid flex-[4] min-w-0 gap-1.5">
                  <Label htmlFor="product" className="text-xs">Product</Label>
                  <div className="relative">
                    <ReactSelect
                      instanceId="product-select"
                      placeholder="Select product..."
                      isClearable
                      tabSelectsValue={true}
                      openMenuOnFocus={true}
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

                        const product = products.find(
                          (p) => p.id === option.value
                        );
                        if (product && product.uom_allowed.length > 0) {
                           if (product.uom_allowed.includes('KGS')) {
                            setUom('KGS');
                          } else {
                            setUom(product.uom_allowed[0]);
                          }
                        }
                        
                        // Advance focus to UOM
                        if (option) {
                          setTimeout(() => uomTriggerRef.current?.focus(), 0);
                        }
                      }}
                      styles={reactSelectStyles}
                      filterOption={(option, input) =>
                        option.label
                          .toLowerCase()
                          .includes(input.toLowerCase()) ||
                        option.value.toLowerCase().includes(input.toLowerCase())
                      }
                      ref={productSelectRef}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7"
                      onClick={() => setIsProductLocked(!isProductLocked)}
                      disabled={!selectedProductId}
                      tabIndex={-1}
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
                <div className="grid w-24 shrink-0 gap-1.5">
                  <Label htmlFor="uom" className="text-xs">UOM</Label>
                  <Select
                    value={uom}
                    onValueChange={(val) => {
                      setUom(val);
                      // Confirm and move to Qty
                      setTimeout(() => qtyInputRef.current?.focus(), 50);
                    }}
                    disabled={!selectedProductData}
                  >
                    <SelectTrigger id="uom" ref={uomTriggerRef}>
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
                <div className="grid w-24 shrink-0 gap-1.5">
                  <Label htmlFor="qty" className="text-xs">Qty</Label>
                  <Input
                    id="qty"
                    type="number"
                    placeholder="0.00"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    ref={qtyInputRef}
                    onKeyDown={handleQtyKeyDown}
                  />
                </div>
                <div className="grid w-24 shrink-0 gap-1.5">
                  <Label htmlFor="rate" className="text-xs">Rate</Label>
                  <Input
                    id="rate"
                    type="number"
                    placeholder="0.00"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    ref={rateInputRef}
                    onKeyDown={handleRateKeyDown}
                  />
                </div>
                <div className="shrink-0">
                  <Button
                    onClick={handleAddItem}
                    className="h-10 w-10 p-0"
                    size="icon"
                  >
                    <PlusCircle className="h-5 w-5" />
                    <span className="sr-only">Add Item</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-headline">Current Bill</CardTitle>
              <CardDescription>
                {selectedCustomerId
                  ? `Items added for ${selectedCustomerData?.name_en}.`
                  : 'No customer selected. Add items for a walk-in bill.'}
              </CardDescription>
            </CardHeader>
            <CardContent ref={billItemsContainerRef} className="max-h-[calc(100vh-26rem)] min-h-[22rem] overflow-auto p-0 border-t">
              <div className="">
                <Table className="w-full table-fixed border-collapse">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b">
                      <TableHead className="w-[35px] px-1 text-center font-bold text-xs uppercase text-muted-foreground">S/N</TableHead>
                      <TableHead className="px-1 text-left font-bold text-xs uppercase text-muted-foreground">Product (பெயர்)</TableHead>
                      <TableHead className="w-[50px] px-1 text-center font-bold text-xs uppercase text-muted-foreground">UOM</TableHead>
                      <TableHead className="w-[75px] px-1 text-center font-bold text-xs uppercase text-muted-foreground text-center">Qty</TableHead>
                      <TableHead className="w-[95px] px-1 text-right font-bold text-xs uppercase text-muted-foreground">Rate</TableHead>
                      <TableHead className="w-[105px] px-1 text-right font-bold text-xs uppercase text-muted-foreground">Amount</TableHead>
                      <TableHead className="w-[45px] px-1 text-right font-bold text-xs uppercase text-muted-foreground"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isBillItemsLoading && !billItems ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                            Loading items...
                        </TableCell>
                      </TableRow>
                    ) : billItems && billItems.length > 0 ? (
                      billItems.map((item, index) => (
                        <TableRow key={item.id} className="h-10 hover:bg-muted/50 border-b last:border-0">
                          <TableCell className="px-1 text-center text-sm text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="px-1 font-medium text-sm truncate" title={item.product}>
                            {item.product}
                          </TableCell>
                          <TableCell className="px-1 text-center text-sm">{item.uom}</TableCell>
                          <TableCell className="px-1">
                            <Input
                              type="number"
                              defaultValue={item.qty}
                              onBlur={(e) =>
                                persistItemUpdate(item.id, 'qty', e.target.value)
                              }
                              onFocus={(e) => e.target.select()}
                              className="mx-auto h-7 w-[65px] text-center font-mono text-sm px-1"
                            />
                          </TableCell>
                          <TableCell className="px-1 text-right">
                            <Input
                              type="number"
                              defaultValue={item.rate}
                              onBlur={(e) =>
                                persistItemUpdate(item.id, 'rate', e.target.value)
                              }
                              onFocus={(e) => e.target.select()}
                              className="ml-auto h-7 w-[85px] text-right font-mono text-sm px-1"
                            />
                          </TableCell>
                          <TableCell className="px-1 text-right font-mono text-sm font-semibold">
                            {item.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="px-1 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete item</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            No items added yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {(billItems && billItems.length > 0) && (
              <CardFooter className="flex flex-col items-stretch gap-2 border-t pt-4 sm:items-end">
                <div className="grid w-full max-w-sm grid-cols-2 gap-x-4 gap-y-1 self-end text-right text-lg">
                  <span className="font-semibold">Items Total:</span>
                  <span className="font-mono">
                    ₹{itemsTotal.toFixed(2)}
                  </span>

                  <span className="font-semibold">Delivery Charge:</span>
                  <Input
                    className="ml-auto max-w-32 text-right font-mono"
                    placeholder="0.00"
                    type="number"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(e.target.value)}
                  />
                  
                  <span className="font-semibold">Bill Total:</span>
                  <span className="font-mono font-bold">
                    ₹{totalAmount.toFixed(2)}
                  </span>
                  
                  <span className="font-semibold">Prev Balance:</span>
                  <span className="font-mono">
                    ₹{previousBalance.toFixed(2)}
                  </span>
                  
                  <span className="font-semibold">Paid:</span>
                  <Input
                    className="ml-auto max-w-32 text-right font-mono"
                    placeholder="0.00"
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />

                  <span className="font-semibold">Balance:</span>
                  <span className="font-mono font-bold">
                    ₹{finalBalance.toFixed(2)}
                  </span>
                </div>
                <div className="hidden flex-wrap justify-end gap-2 md:flex">
                  <Button size="lg" variant="outline" onClick={handleSaveBill} disabled={!selectedCustomerId}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Bill
                  </Button>
                  <Button onClick={() => handlePrintBill('thermal')}>
                    Print Receipt (106mm)
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handlePrintBill('a4')}
                  >
                    Print A4
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleShareWhatsApp}
                  >
                    <Share className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
      {/* Sticky Footer for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-10 h-20 border-t bg-background/95 px-4 py-2 md:hidden">
          <div className="flex h-full w-full items-center justify-between gap-4">
            <div className="text-left">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="font-mono text-lg font-bold">
                ₹{finalBalance.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="lg"
                className="flex-1"
                onClick={handleAddItem}
                disabled={!qty || !rate}
              >
                <PlusCircle className="h-5 w-5 md:mr-2" />
                <span className="hidden sm:inline">Add Item</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="lg" variant="outline" className="px-3" disabled={!billItems || billItems.length === 0}>
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="mb-2">
                  <DropdownMenuItem onClick={handleSaveBill} disabled={!selectedCustomerId}>
                    <Save className="mr-2 h-4 w-4" />
                    <span>Save & New</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrintBill('thermal')}>
                    <Printer className="mr-2 h-4 w-4" />
                    <span>Print Receipt</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrintBill('a4')}>
                    <Printer className="mr-2 h-4 w-4" />
                    <span>Print A4</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareWhatsApp}>
                    <Share className="mr-2 h-4 w-4" />
                    <span>Share WhatsApp</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      <AlertDialog open={showPrintConfirm} onOpenChange={setShowPrintConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Confirm Before Printing</AlertDialogTitle>
                <AlertDialogDescription>
                    Do you want to save this bill before printing?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-2 pt-2">
                <Button onClick={handleSaveAndPrintConfirm} disabled={!selectedCustomerId}>Save & Print</Button>
                <Button variant="outline" onClick={handlePrintWithoutSavingConfirm}>Print Without Saving</Button>
                <Button variant="ghost" onClick={() => setShowPrintConfirm(false)}>Cancel</Button>
                {!selectedCustomerId && 
                    <p className="text-xs text-muted-foreground pt-2 text-center">
                        "Save & Print" requires a customer to be selected.
                    </p>
                }
            </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showWhatsAppShareConfirm} onOpenChange={setShowWhatsAppShareConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Share on WhatsApp</AlertDialogTitle>
                <AlertDialogDescription>
                    Do you want to open WhatsApp now to share this bill summary?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowWhatsAppShareConfirm(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmOpenWhatsApp}>Open WhatsApp</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
