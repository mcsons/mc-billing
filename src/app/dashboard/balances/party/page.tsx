
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

export default function PartyBalancePage() {
  const { parties, partyBalances, setPartyBalance, currentUser } = useData();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();

  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [balance, setBalance] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const selectedParty = parties.find(p => p.id === selectedPartyId);
  const currentBalance = selectedPartyId ? partyBalances[selectedPartyId] || 0 : 0;

  // Initialize input when party changes
  useEffect(() => {
    if (selectedParty) {
      setBalance(currentBalance.toFixed(2));
    } else {
      setBalance('');
    }
    setIsEditing(false);
  }, [selectedPartyId]);

  // Update input only if background data changes AND we aren't currently typing
  useEffect(() => {
    if (selectedParty && !isEditing) {
      setBalance(currentBalance.toFixed(2));
    }
  }, [currentBalance, isEditing, selectedParty]);

  const handleSave = () => {
    const newBalanceValue = parseFloat(balance);
    if (!selectedPartyId || isNaN(newBalanceValue)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please select a party and enter a valid balance.',
      });
      return;
    }

    showAlertDialog({
      title: 'Confirm Balance Update',
      description: `Are you sure you want to set ${selectedParty?.name}'s balance to ₹${newBalanceValue.toFixed(2)}? This will overwrite the current balance value.`,
      onConfirm: () => {
        setPartyBalance(selectedPartyId, newBalanceValue);
        setIsEditing(false);
        toast({
          title: 'Balance Updated',
          description: `${selectedParty?.name}'s balance has been updated.`,
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
        <CardTitle className="font-headline">Party Balance</CardTitle>
        <CardDescription>Search for a party to view and edit their balance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="party-select">Party</Label>
          <ReactSelect
            instanceId="party-balance-select"
            inputId="party-select"
            options={parties.map(p => ({ value: p.id, label: p.name }))}
            value={selectedParty ? { value: selectedParty.id, label: selectedParty.name } : null}
            onChange={option => setSelectedPartyId(option ? option.value : '')}
            isClearable
            placeholder="Search by name or ID..."
            styles={reactSelectStyles}
          />
        </div>
        {selectedPartyId && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-lg">{selectedParty?.name}</h3>
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
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'CREATOR') && (
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Balance
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
