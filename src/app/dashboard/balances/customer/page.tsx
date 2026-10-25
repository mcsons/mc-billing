'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import ReactSelect, { type StylesConfig } from 'react-select';
import { Edit, Save } from 'lucide-react';
import { useAlertDialog } from '@/context/AlertDialogProvider';

export default function CustomerBalancePage() {
  const { customers, openingBalances, customerBalances, setOpeningBalance, currentUser } = useData();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [openingBalance, setOpeningBalanceInput] = useState('');
  const [currentBalance, setCurrentBalanceInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const canEditBalances = currentUser?.role === 'ADMIN' || currentUser?.role === 'CREATOR';

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Database values
  const openingBalanceValue = selectedCustomerId ? openingBalances[selectedCustomerId] || 0 : 0;
  const currentTotalBalance = selectedCustomerId ? customerBalances[selectedCustomerId] || 0 : 0;

  // Initialize inputs when customer changes or calculated total changes
  useEffect(() => {
    if (selectedCustomer) {
      setOpeningBalanceInput(openingBalanceValue.toFixed(2));
      setCurrentBalanceInput(currentTotalBalance.toFixed(2));
    } else {
      setOpeningBalanceInput('');
      setCurrentBalanceInput('');
    }
    setIsEditing(false);
  }, [selectedCustomerId, openingBalanceValue, currentTotalBalance, selectedCustomer]);

  // Update inputs only if background data changes AND we aren't currently typing
  useEffect(() => {
    if (selectedCustomer && !isEditing) {
      setOpeningBalanceInput(openingBalanceValue.toFixed(2));
      setCurrentBalanceInput(currentTotalBalance.toFixed(2));
    }
  }, [openingBalanceValue, currentTotalBalance, isEditing, selectedCustomer]);

  const handleSave = () => {
    if (!canEditBalances) {
      toast({ variant: 'destructive', title: 'Access Denied', description: 'You do not have permission to edit balances.' });
      return;
    }

    const newOpeningInput = parseFloat(openingBalance);
    const newCurrentInput = parseFloat(currentBalance);

    if (!selectedCustomerId || isNaN(newOpeningInput) || isNaN(newCurrentInput)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please select a customer and enter valid numbers for both balances.',
      });
      return;
    }

    // Logic to support independent edits:
    // 1. We treat the 'openingBalance' input as the new desired base starting point.
    // 2. We treat 'currentBalance' input as the target final reconciliation point.
    // 3. To satisfy both, we calculate what the opening balance must be so that 
    //    'NewOpening + Activity = NewCurrent'.
    
    // Activity = CurrentTotal - OldOpening
    const activity = currentTotalBalance - openingBalanceValue;
    
    // Expected Current with New Opening = NewOpening + activity
    const expectedCurrent = newOpeningInput + activity;
    
    // Reconciliation Delta = How much the user shifted the Current Balance target
    const reconDelta = newCurrentInput - expectedCurrent;
    
    // Final Base Opening to save = NewOpening + reconDelta
    const finalOpeningToSave = Number((newOpeningInput + reconDelta).toFixed(2));

    showAlertDialog({
      title: 'Confirm Balance Update',
      description: `Updating ${selectedCustomer?.name_en}. Your changes will reconcile the account to an Opening Balance of ₹${finalOpeningToSave.toFixed(2)} to match your target Current Balance of ₹${newCurrentInput.toFixed(2)}.`,
      onConfirm: () => {
        setOpeningBalance(selectedCustomerId, finalOpeningToSave);
        setIsEditing(false);
        toast({
          title: 'Balances Updated',
          description: `${selectedCustomer?.name_en}'s account has been reconciled and saved.`,
        });
      },
    });
  };

  type OptionType = { value: string; label: string };

  const reactSelectStyles: StylesConfig<OptionType, false> = {
    control: (baseStyles, state) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      '&:hover': {
        borderColor: 'hsl(var(--ring))',
      },
    }),
    menu: (baseStyles, _state) => ({
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
        <CardDescription>Search for a customer to view and manage their opening and current balances.</CardDescription>
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
            filterOption={(option, input) => {
              if (!input) return true;
              const isNumeric = /^\d+$/.test(input);
              if (isNumeric) return option.value === input || option.value === String(parseInt(input, 10));
              return option.label.toLowerCase().startsWith(input.toLowerCase());
          }}
          />
        </div>
        {selectedCustomerId && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-lg">{selectedCustomer?.name_en}</h3>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Opening Balance (Base)</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={openingBalance}
                    onChange={e => setOpeningBalanceInput(e.target.value)}
                    className="w-full text-2xl font-mono"
                    onFocus={(e) => e.target.select()}
                    disabled={!canEditBalances}
                  />
                ) : (
                  <p className="text-2xl font-bold font-mono opacity-70">₹{openingBalanceValue.toFixed(2)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Current Total Balance</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={currentBalance}
                    onChange={e => setCurrentBalanceInput(e.target.value)}
                    className="w-full text-2xl font-mono text-primary font-bold"
                    onFocus={(e) => e.target.select()}
                    disabled={!canEditBalances}
                  />
                ) : (
                  <p className="text-2xl font-bold font-mono text-primary">₹{currentTotalBalance.toFixed(2)}</p>
                )}
              </div>
            </div>

            {canEditBalances && (
              <div className="flex gap-2 pt-4">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Balances
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
