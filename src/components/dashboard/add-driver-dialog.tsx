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
import { Driver } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '../ui/switch';

interface AddDriverDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  driverToEdit?: Driver | null;
}

export function AddDriverDialog({
  isOpen,
  onOpenChange,
  driverToEdit,
}: AddDriverDialogProps) {
  const { addDriver, editDriver } = useData();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [active, setActive] = useState(true);

  const isEditing = !!driverToEdit;

  useEffect(() => {
    if (isEditing && driverToEdit) {
      setName(driverToEdit.name);
      setLicenseNumber(driverToEdit.licenseNumber);
      setActive(driverToEdit.active);
    } else {
      setName('');
      setLicenseNumber('');
      setActive(true);
    }
  }, [driverToEdit, isEditing, isOpen]);

  const handleSubmit = () => {
    if (!name || !licenseNumber) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please enter driver name and license number.' });
        return;
    }

    if (isEditing && driverToEdit) {
      editDriver(driverToEdit.id, { name, licenseNumber, active });
      toast({ title: 'Driver Updated', description: `"${name}" has been updated.` });
    } else {
      addDriver({ name, licenseNumber });
      toast({ title: 'Driver Added', description: `"${name}" has been added.` });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? `Editing details for ${driverToEdit?.name}.`
              : 'Enter the details for the new driver.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="license" className="text-right">
              License No.
            </Label>
            <Input
              id="license"
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              className="col-span-3"
            />
          </div>
           <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="active" className="text-right">
              Active
            </Label>
            <div className="col-span-3">
              <Switch
                id="active"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            {isEditing ? 'Save Changes' : 'Add Driver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    