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

export default function PartyBoxBalancePage() {
  const { parties, partyOpeningBoxBalances, partyBoxBalances, setPartyOpeningBoxBalance, currentUser } = useData();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();

  const [selectedPartyId, setselectedPartyId] = useState('');
  const [editingMode, setEditingMode] = useState<'none' | 'opening' | 'current'>('none');
  const [editValue, setEditValue] = useState('');

  const selectedParty = parties.find(c => c.id === selectedPartyId);

  // openingBalanceValue is the base stored in DB
  const openingBalanceValue = selectedPartyId ? partyOpeningBoxBalances[selectedPartyId] || 0 : 0;
  // currentTotalBalance is the calculated result (Opening + Activity)
  const currentTotalBalance = selectedPartyId ? partyBoxBalances[selectedPartyId] || 0 : 0;

  // Initialize input when Party changes
  useEffect(() => {
    setEditingMode('none');
    setEditValue('');
  }, [selectedPartyId, selectedParty]);

  const handleSave = () => {
    const newValue = parseInt(editValue, 10);
    if (!selectedPartyId || isNaN(newValue)) {
      toast({
        variant: 'destructive',
        title: 'Invalid Input',
        description: 'Please select a Party and enter a valid box balance.',
      });
      return;
    }

    if (editingMode === 'current') {
      const delta = newValue - currentTotalBalance;
      const adjustedOpeningValue = openingBalanceValue + delta;

      showAlertDialog({
        title: 'Confirm Box Balance Update',
        description: `Are you sure you want to set ${selectedParty?.name}'s Current Total Box Balance to ${newValue}? This will reconcile their account by adjusting the base balance.`,
        onConfirm: () => {
          setPartyOpeningBoxBalance(selectedPartyId, adjustedOpeningValue);
          setEditingMode('none');
          toast({
            title: 'Box Balance Updated',
            description: `${selectedParty?.name}'s total box balance has been updated.`,
          });
        },
      });
    } else if (editingMode === 'opening') {
      showAlertDialog({
        title: 'Confirm Opening Box Balance Update',
        description: `Are you sure you want to set ${selectedParty?.name}'s Opening Box Balance to ${newValue}? This will shift their overall box balance.`,
        onConfirm: () => {
          setPartyOpeningBoxBalance(selectedPartyId, newValue);
          setEditingMode('none');
          toast({
            title: 'Opening Box Balance Updated',
            description: `${selectedParty?.name}'s opening box balance has been updated.`,
          });
        },
      });
    }
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
        <CardTitle className="font-headline">Box Balance</CardTitle>
        <CardDescription>Search for a Party to view and manage their current box balance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="Party-select">Party</Label>
          <ReactSelect
            instanceId="box-balance-Party-select"
            inputId="Party-select"
            options={parties.map(p => ({ value: p.id, label: p.name }))}
            value={selectedParty ? { value: selectedParty.id, label: selectedParty.name } : null}
            onChange={option => setselectedPartyId(option ? option.value : '')}
            isClearable
            autoFocus
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
        {selectedPartyId && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-lg">{selectedParty?.name}</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Opening Box Balance (Base)</Label>
                <div className="flex items-center gap-2">
                  {editingMode === 'opening' ? (
                    <Input
                      type="number"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-full text-2xl font-mono text-primary font-bold"
                      autoFocus
                      onFocus={(e) => e.target.select()}
                    />
                  ) : (
                    <p className="text-2xl font-bold font-mono opacity-70">{openingBalanceValue}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs uppercase tracking-wider">Current Total Box Balance</Label>
                <div className="flex items-center gap-2">
                  {editingMode === 'current' ? (
                    <Input
                      type="number"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-full text-2xl font-mono text-primary font-bold"
                      autoFocus
                      onFocus={(e) => e.target.select()}
                    />
                  ) : (
                    <p className="text-2xl font-bold font-mono text-primary">{currentTotalBalance}</p>
                  )}
                </div>
              </div>
            </div>

            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'CREATOR') && (
              <div className="flex gap-2 pt-2">
                {editingMode === 'none' ? (
                  <>
                    <Button onClick={() => { setEditingMode('current'); setEditValue(currentTotalBalance.toString()); }}>
                      <Edit className="mr-2 h-4 w-4" /> Edit Current Box Balance
                    </Button>
                    <Button variant="outline" onClick={() => { setEditingMode('opening'); setEditValue(openingBalanceValue.toString()); }}>
                      <Edit className="mr-2 h-4 w-4" /> Edit Opening Box Balance
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleSave}>
                      <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                    <Button variant="ghost" onClick={() => setEditingMode('none')}>Cancel</Button>
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


