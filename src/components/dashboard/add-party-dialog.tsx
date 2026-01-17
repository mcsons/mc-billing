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
import { Party } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '../ui/switch';

interface AddPartyDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  partyToEdit?: Party | null;
}

export function AddPartyDialog({
  isOpen,
  onOpenChange,
  partyToEdit,
}: AddPartyDialogProps) {
  const { addParty, editParty } = useData();
  const { toast } = useToast();
  
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [active, setActive] = useState(true);

  const isEditing = !!partyToEdit;

  useEffect(() => {
    if (isEditing && partyToEdit) {
      setId(partyToEdit.id);
      setName(partyToEdit.name);
      setLocation(partyToEdit.location);
      setActive(partyToEdit.active);
    } else {
      setId('');
      setName('');
      setLocation('');
      setActive(true);
    }
  }, [partyToEdit, isEditing, isOpen]);

  const handleSubmit = () => {
    if (!name || !location) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please enter a name and location for the party.' });
        return;
    }

    if (isEditing && partyToEdit) {
      editParty(partyToEdit.id, { name, location, active });
    } else {
      addParty({ id: id || undefined, name, location });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Party' : 'Add New Party'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? `Editing details for ${partyToEdit?.name}.`
              : 'Enter details for the new party. Leave ID blank to auto-generate.'
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
              placeholder={isEditing ? '' : 'e.g., PT010 (Optional)'}
              disabled={isEditing}
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="name">Party Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
           <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <Label htmlFor="active" className="flex flex-col space-y-1">
                <span>Active</span>
                <span className="font-normal leading-snug text-muted-foreground">
                    Inactive parties won't appear in selection lists.
                </span>
            </Label>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            {isEditing ? 'Save Changes' : 'Add Party'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
