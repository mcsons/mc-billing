'use client';
import { useState } from 'react';
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

interface AddCustomerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function AddCustomerDialog({
  isOpen,
  onOpenChange,
}: AddCustomerDialogProps) {
  const { addCustomer } = useData();
  const [id, setId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    // The logic to auto-generate ID if `id` is empty is now in the DataContext
    const newCustomer: Omit<Customer, 'id'> & { id?: string } = {
      id: id || undefined, // Pass undefined if id is empty string
      name_en: nameEn,
      name_ta: nameTa,
      phone: phone,
    };
    addCustomer(newCustomer);
    onOpenChange(false);
    // Reset form
    setId('');
    setNameEn('');
    setNameTa('');
    setPhone('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
          <DialogDescription>
            Enter the details for the new customer. Leave ID blank to auto-generate.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="id" className="text-right">
              ID (Optional)
            </Label>
            <Input
              id="id"
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              className="col-span-3"
              placeholder="e.g., C010"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name_en" className="text-right">
              Name (English)
            </Label>
            <Input
              id="name_en"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name_ta" className="text-right">
              Name (Tamil)
            </Label>
            <Input
              id="name_ta"
              value={nameTa}
              onChange={(e) => setNameTa(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="phone" className="text-right">
              Phone
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            Add Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
