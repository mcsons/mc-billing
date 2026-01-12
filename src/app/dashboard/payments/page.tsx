
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
import { Check, ChevronsUpDown, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

export default function PaymentsPage() {
  const { customers, customerBalances, addPayment } = useData();
  const { toast } = useToast();

  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const currentBalance = selectedCustomerId ? customerBalances[selectedCustomerId] || 0 : 0;
  const newBalance = currentBalance - (parseFloat(amount) || 0);
  
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId === selectedCustomerId ? '' : customerId);
    setCustomerPopoverOpen(false);
  };

  const handleSubmit = () => {
    const paymentAmount = parseFloat(amount);
    if (!selectedCustomerId || !paymentAmount || isNaN(paymentAmount)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Payment',
        description: 'Please select a customer and enter a valid payment amount.',
      });
      return;
    }

    addPayment({
      customerId: selectedCustomerId,
      amount: paymentAmount,
      notes: notes,
    });

    toast({
      title: 'Payment Recorded',
      description: `₹${paymentAmount.toFixed(2)} payment from ${selectedCustomer?.name_en} has been recorded.`,
    });
    
    // Reset form
    setSelectedCustomerId('');
    setAmount('');
    setNotes('');
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline">Record Payment</CardTitle>
        <CardDescription>
          Record a payment received from a customer to update their balance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="customer">Customer</Label>
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
                  ? `${selectedCustomer.name_en} (${selectedCustomer.name_ta})`
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

        {selectedCustomerId && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
                <div>
                    <Label>Current Balance</Label>
                    <p className="text-2xl font-bold font-mono">₹{currentBalance.toFixed(2)}</p>
                </div>
                 <div className="text-right">
                    <Label>New Balance</Label>
                    <p className="text-2xl font-bold font-mono">₹{newBalance.toFixed(2)}</p>
                </div>
            </div>
        )}

        <div className="grid gap-2">
            <Label htmlFor="amount">Payment Amount (₹)</Label>
            <Input 
                id="amount" 
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
            />
        </div>
        <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea 
                id="notes"
                placeholder="e.g., Cash payment for last week's bill"
                value={notes}
                onChange={e => setNotes(e.target.value)}
            />
        </div>

      </CardContent>
      <CardFooter>
        <Button size="lg" onClick={handleSubmit} disabled={!selectedCustomerId || !amount}>
          <Save className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </CardFooter>
    </Card>
  );
}
