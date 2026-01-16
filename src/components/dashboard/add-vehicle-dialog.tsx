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
import { Vehicle } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '../ui/switch';

interface AddVehicleDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  vehicleToEdit?: Vehicle | null;
}

export function AddVehicleDialog({
  isOpen,
  onOpenChange,
  vehicleToEdit,
}: AddVehicleDialogProps) {
  const { addVehicle, editVehicle } = useData();
  const { toast } = useToast();
  
  const [id, setId] = useState(''); // Registration Number
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);

  const isEditing = !!vehicleToEdit;

  useEffect(() => {
    if (isEditing && vehicleToEdit) {
      setId(vehicleToEdit.id);
      setName(vehicleToEdit.name);
      setActive(vehicleToEdit.active);
    } else {
      setId('');
      setName('');
      setActive(true);
    }
  }, [vehicleToEdit, isEditing, isOpen]);

  const handleSubmit = () => {
    if (!id || !name) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please enter registration number and vehicle name.' });
        return;
    }

    const vehicleData = {
      id: id.toUpperCase(),
      name: name,
    };

    if (isEditing && vehicleToEdit) {
      editVehicle(vehicleToEdit.id, { ...vehicleData, active });
      toast({ title: 'Vehicle Updated', description: `Vehicle ${id.toUpperCase()} has been updated.` });
    } else {
      addVehicle(vehicleData);
      toast({ title: 'Vehicle Added', description: `Vehicle ${id.toUpperCase()} has been added.` });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? `Editing details for ${vehicleToEdit?.id}.`
              : 'Enter the details for the new vehicle.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="id" className="text-right">
              Reg. Number
            </Label>
            <Input
              id="id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              className="col-span-3 uppercase"
              placeholder="e.g., TN39AC7786"
              disabled={isEditing}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Vehicle Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Tata Ace"
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
            {isEditing ? 'Save Changes' : 'Add Vehicle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    