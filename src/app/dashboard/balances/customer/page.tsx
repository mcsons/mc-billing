'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import ReactSelect from 'react-select';
import { Edit, Save } from 'lucide-react';
import { useAlertDialog } from '@/context/AlertDialogProvider';

export default function CustomerBalancePage() {
  const { customers, customerBalances, setOpeningBalance } = useData();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [balance, setBalance] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const currentBalance = selectedCustomerId ? customerBalances[selectedCustomerId] || 0 : 0;

  useEffect(() => {
    if (selectedCustomer) {
      setBalance(currentBalance.toFixed(2));
      setIsEditing(false);
    } else {
      setBalance('');
      setIsEditing(false);
    }
  }, [selectedCustomerId, currentBalance, selectedCustomer]);

  const handleSave = () => {
    const newBalanceValue = parseFloat(balance);
    if (!selectedCustomerId || isNaN(newBalanceValue)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please select a customer and enter a valid balance.',
      });
      return;
    }

    showAlertDialog({
      title: 'Confirm Balance Update',
      description: `Are you sure you want to set ${selectedCustomer?.name_en}'s balance to ₹${newBalanceValue.toFixed(2)}? This will be set as the new opening balance, affecting all future calculations.`,
      onConfirm: () => {
        setOpeningBalance(selectedCustomerId, newBalanceValue);
        setIsEditing(false);
        toast({
          title: 'Balance Updated',
          description: `${selectedCustomer?.name_en}'s balance has been updated.`,
        });
      },
    });
  };
  
  const reactSelectStyles = {
    control: (baseStyles, state) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    menu: (baseStyles) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--card))',
      zIndex: 50,
    }),
    option: (baseStyles, state) => ({
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
    singleValue: (baseStyles) => ({
      ...baseStyles,
      color: 'hsl(var(--foreground))',
    }),
    input: (baseStyles) => ({
      ...baseStyles,
      color: 'hsl(var(--foreground))',
    }),
     placeholder: (baseStyles) => ({
      ...baseStyles,
      color: 'hsl(var(--muted-foreground))',
    }),
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline">Customer Balance</CardTitle>
        <CardDescription>Search for a customer to view and edit their opening balance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="customer-select">Customer</Label>
          <ReactSelect
            instanceId="customer-balance-select"
            inputId="customer-select"
            options={customers.map(c => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` }))}
            value={selectedCustomer ? { value: selectedCustomer.id, label: `${selectedCustomer.name_en} (${selectedCustomer.name_ta})` } : null}
            onChange={option => setSelectedCustomerId(option ? option.value : '')}
            isClearable
            placeholder="Search by name or ID..."
            styles={reactSelectStyles}
          />
        </div>
        {selectedCustomerId && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-lg">{selectedCustomer?.name_en}</h3>
            <div className="flex items-center gap-4">
              <Label className="text-lg">Current Balance:</Label>
              {isEditing ? (
                <Input
                  type="number"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  className="w-48 text-2xl font-mono"
                  autoFocus
                />
              ) : (
                <p className="text-2xl font-bold font-mono">₹{currentBalance.toFixed(2)}</p>
              )}
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2" /> Edit Balance
                </Button>
              ) : (
                <>
                  <Button onClick={handleSave}>
                    <Save className="mr-2" /> Save
                  </Button>
                  <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
