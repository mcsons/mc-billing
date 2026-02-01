'use client';
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/context/DataContext';
import { Customer } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

interface AddCustomerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  customerToEdit?: Customer | null;
}

export function AddCustomerDialog({
  isOpen,
  onOpenChange,
  customerToEdit,
}: AddCustomerDialogProps) {
  const { addCustomer, editCustomer } = useData();
  const { toast } = useToast();

  const [id, setId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [phone, setPhone] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');

  const isEditing = !!customerToEdit;

  useEffect(() => {
    if (isEditing && customerToEdit) {
      setId(customerToEdit.id);
      setNameEn(customerToEdit.name_en);
      setNameTa(customerToEdit.name_ta);
      setPhone(customerToEdit.phone);
      // Opening balance is not edited here to prevent accidental changes.
      // It should be managed from the balance page.
      setOpeningBalance('0'); 
    } else {
      setId('');
      setNameEn('');
      setNameTa('');
      setPhone('');
      setOpeningBalance('0');
    }
  }, [customerToEdit, isEditing, isOpen]);


  const handleSubmit = async () => {
    if (!nameEn) {
        toast({ variant: 'destructive', title: 'Missing Field', description: 'English name is required.' });
        return;
    }

    if (isEditing && customerToEdit) {
      await editCustomer(customerToEdit.id, { id, name_en: nameEn, name_ta: nameTa, phone });
    } else {
      await addCustomer({
        id: id || undefined,
        name_en: nameEn,
        name_ta: nameTa,
        phone: phone,
        openingBalance: parseFloat(openingBalance) || 0,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the details for this customer.' 
              : 'Enter the details for the new customer. Leave ID blank to auto-generate.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="id">ID</Label>
            <Input
              id="id"
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              placeholder={isEditing ? '' : 'e.g., C010 (Optional)'}
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="name_en">Name (English)</Label>
            <Input
              id="name_en"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="name_ta">Name (Tamil)</Label>
            <Input
              id="name_ta"
              value={nameTa}
              onChange={(e) => setNameTa(e.target.value)}
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {!isEditing && (
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="opening_balance">Opening Balance (₹)</Label>
              <Input
                id="opening_balance"
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            {isEditing ? 'Save Changes' : 'Add Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
