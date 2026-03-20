
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
  const { customers, openingBalances, customerBalances, setOpeningBalance, currentUser } = useData();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [balance, setBalance] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  
  // Logical Fix: Show/Edit the "Opening Balance" record, not the calculated total.
  const openingBalanceValue = selectedCustomerId ? openingBalances[selectedCustomerId] || 0 : 0;
  const currentTotalBalance = selectedCustomerId ? customerBalances[selectedCustomerId] || 0 : 0;

  // Initialize input when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      setBalance(openingBalanceValue.toFixed(2));
    } else {
      setBalance('');
    }
    setIsEditing(false);
  }, [selectedCustomerId]);

  // Update input only if background data changes AND we aren't currently typing
  useEffect(() => {
    if (selectedCustomer && !isEditing) {
      setBalance(openingBalanceValue.toFixed(2));
    }
  }, [openingBalanceValue, isEditing, selectedCustomer]);

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
      description: `Are you sure you want to set ${selectedCustomer?.name_en}'s Opening Balance to ₹${newBalanceValue.toFixed(2)}? This will update the starting point for their account.`,
      onConfirm: () => {
        setOpeningBalance(selectedCustomerId, newBalanceValue);
        setIsEditing(false);
        toast({
          title: 'Opening Balance Updated',
          description: `${selectedCustomer?.name_en}'s opening balance has been updated.`,
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
            
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Opening Balance</Label>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <Input
                            type="number"
                            value={balance}
                            onChange={e => setBalance(e.target.value)}
                            className="w-full text-2xl font-mono"
                            autoFocus
                            />
                        ) : (
                            <p className="text-2xl font-bold font-mono">₹{openingBalanceValue.toFixed(2)}</p>
                        )}
                    </div>
                </div>
                <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Current Total Balance</Label>
                    <p className="text-2xl font-bold font-mono text-primary">₹{currentTotalBalance.toFixed(2)}</p>
                </div>
            </div>

            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'CREATOR') && (
              <div className="flex gap-2 pt-2">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Opening Balance
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
