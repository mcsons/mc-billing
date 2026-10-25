'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Save, Loader2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useLoading } from '@/context/LoadingContext';
import { useToast } from '@/hooks/use-toast';
import ReactSelect from 'react-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Timestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export default function EmptyBoxEntryPage() {
  const { customers, boxBills, openingBoxBalances, addOrUpdateBoxBill, recalculateFutureBoxBalances, addBoxBillEntry } = useData();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { setLoading } = useLoading();

  const [date, setDate] = useState<Date>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [emptyBox, setEmptyBox] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const customerSelectRef = useRef<any>(null);
  const emptyBoxInputRef = useRef<HTMLInputElement>(null);

  // Focus empty box input when customer is selected
  useEffect(() => {
    if (selectedCustomerId && emptyBoxInputRef.current) {
      emptyBoxInputRef.current.focus();
    }
  }, [selectedCustomerId]);

  const reactSelectStyles = {
    container: (baseStyles: any) => ({ ...baseStyles, width: '100%' }),
    control: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      minHeight: '44px',
      '&:hover': { borderColor: 'hsl(var(--ring))' },
    }),
    menu: (baseStyles: any) => ({ ...baseStyles, backgroundColor: 'hsl(var(--card))', zIndex: 50 }),
    option: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: state.isFocused ? 'hsl(var(--accent))' : 'transparent',
      color: state.isSelected ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
      '&:active': { backgroundColor: 'hsl(var(--accent))' },
    }),
    singleValue: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--foreground))' }),
    input: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--foreground))' }),
    placeholder: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--muted-foreground))' }),
  };

  const customerOptions = customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }));

  const computeBoxBalanceUpToDate = (customerId: string, targetDate: Date) => {
    const initial = openingBoxBalances[customerId] || 0;
    const priorBills = boxBills.filter(b => {
      if (b.customerId !== customerId) return false;
      const bDate = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
      const bDay = new Date(bDate); bDay.setHours(0,0,0,0);
      const tDay = new Date(targetDate); tDay.setHours(0,0,0,0);
      return bDay.getTime() < tDay.getTime();
    });
    if (priorBills.length === 0) return initial;
    priorBills.sort((a,b) => {
      const aD = a.billDate?.toDate ? a.billDate.toDate() : new Date(a.billDate);
      const bD = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
      return bD.getTime() - aD.getTime();
    });
    return priorBills[0].balanceBox;
  };

  const handleSaveEmptyBox = async () => {
    if (!selectedCustomerId || !emptyBox || isNaN(parseInt(emptyBox))) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a customer and enter a valid empty box amount.' });
      return;
    }

    if (isSaving) return;
    setIsSaving(true);
    setLoading(true, 'Saving Empty Box...');

    try {
      const customer = customers.find(c => c.id === selectedCustomerId);
      const enteredEmptyBoxes = parseInt(emptyBox) || 0;

      // Find if there's an existing bill for this customer on this date
      const existingBill = boxBills.find(b => {
        if (b.customerId !== selectedCustomerId) return false;
        const bDate = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
        return isSameDay(bDate, date);
      });

      let savedBill = null;

      if (existingBill) {
        // Scenario A: Update existing bill
        // Scoped one-time read — box_bill_entries is no longer in global state
        const entriesSnap = await getDocs(query(collection(firestore, 'box_bill_entries'), where('boxBillId', '==', existingBill.id)));
        const existingEntries = entriesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const trueTf = existingEntries.reduce((sum: number, e: any) => sum + (e.boxesAdded || 0), 0);
        const currentEntryEmpty = existingEntries.filter((e: any) => !e.isManualEmpty).reduce((sum: number, e: any) => sum + (e.emptyBoxesAdded || 0), 0);
        
        const manualEmpty = existingBill.manualEmptyBox || 0;
        const updatedEntryEmptyBoxTotal = currentEntryEmpty + enteredEmptyBoxes;
        const finalEmptyBox = updatedEntryEmptyBoxTotal + manualEmpty;
        const updatedBalanceBox = (existingBill.prevBalanceBox + trueTf) - finalEmptyBox;
        
        savedBill = await addOrUpdateBoxBill({
          ...existingBill,
          todaysFishBox: trueTf,
          emptyBox: finalEmptyBox,
          manualEmptyBox: manualEmpty,
          entryEmptyBoxTotal: updatedEntryEmptyBoxTotal,
          finalEmptyBox: finalEmptyBox,
          balanceBox: updatedBalanceBox,
        }, existingBill.id);

      } else {
        // Scenario B: Create new bill
        const prevBal = computeBoxBalanceUpToDate(selectedCustomerId, date);
        const todaysFishBox = 0;
        const totalBox = prevBal + todaysFishBox;
        const manualEmpty = 0;
        const entryEmptyBoxTotal = enteredEmptyBoxes;
        const finalEmptyBox = entryEmptyBoxTotal + manualEmpty;
        const balanceBox = totalBox - finalEmptyBox;

        savedBill = await addOrUpdateBoxBill({
          customerId: selectedCustomerId,
          customerName: customer?.name_en || '',
          billDate: Timestamp.fromDate(date) as any,
          prevBalanceBox: prevBal,
          todaysFishBox,
          totalBox,
          emptyBox: finalEmptyBox,
          manualEmptyBox: manualEmpty,
          entryEmptyBoxTotal: entryEmptyBoxTotal,
          finalEmptyBox: finalEmptyBox,
          balanceBox,
          description: '',
          driverMobile: '',
          driverName: '',
          vehicleNo: '',
        });
      }

      if (savedBill) {
        await addBoxBillEntry({
          boxBillId: savedBill.id,
          customerId: selectedCustomerId,
          entryDate: Timestamp.fromDate(new Date()) as any,
          boxesAdded: 0,
          emptyBoxesAdded: enteredEmptyBoxes,
        });
      }

      await recalculateFutureBoxBalances(selectedCustomerId);

      toast({ title: 'Success', description: 'Empty box entry saved successfully.' });
      
      // Reset form fields
      setEmptyBox('');
      setSelectedCustomerId('');
      if (customerSelectRef.current) {
        customerSelectRef.current.focus();
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save empty box entry.' });
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-lg space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <h1 className="text-2xl font-bold font-headline text-primary">Empty Box Entry</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full sm:w-[180px] justify-start text-left font-medium", !date && "text-muted-foreground", "bg-background text-foreground hover:bg-muted hover:text-foreground border-input")}>
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              {date ? format(date, 'dd-MM-yyyy') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <Card className="shadow-sm border-border w-full">
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="customer-select" className="text-sm font-semibold">Customer</Label>
            <ReactSelect
              ref={customerSelectRef}
              options={customerOptions}
              value={customerOptions.find(o => o.value === selectedCustomerId) || null}
              onChange={(option) => setSelectedCustomerId(option?.value || '')}
              placeholder="Search Customer..."
              styles={reactSelectStyles}
              isClearable
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="empty-box" className="text-sm font-semibold">Empty Box</Label>
            <Input
              ref={emptyBoxInputRef}
              id="empty-box"
              type="number"
              placeholder="0"
              value={emptyBox}
              onChange={(e) => setEmptyBox(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveEmptyBox();
                }
              }}
              className="h-16 shadow-inner font-mono bg-muted/30"
              style={{ fontSize: '24px', fontWeight: 600, textAlign: 'center' }}
            />
          </div>

          <Button 
            className="w-full h-14 text-lg font-bold shadow-md hover:shadow-lg transition-all" 
            onClick={handleSaveEmptyBox}
            disabled={isSaving}
          >
            {isSaving ? (
              <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> Saving Empty Box...</>
            ) : (
              <><Save className="mr-2 h-6 w-6" /> Save Empty Box</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
