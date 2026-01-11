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
import { Checkbox } from '@/components/ui/checkbox';
import { useData } from '@/context/DataContext';
import { Product } from '@/lib/data';

interface AddProductDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const UOM_OPTIONS = ['KGS', 'BOX', 'NOS', 'ITEMS'] as const;
type Uom = typeof UOM_OPTIONS[number];

export function AddProductDialog({
  isOpen,
  onOpenChange,
}: AddProductDialogProps) {
  const { addProduct } = useData();
  const [id, setId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [uoms, setUoms] = useState<Set<Uom>>(new Set());

  const handleUomChange = (uom: Uom, checked: boolean) => {
    setUoms((prev) => {
      const newUoms = new Set(prev);
      if (checked) {
        newUoms.add(uom);
      } else {
        newUoms.delete(uom);
      }
      return newUoms;
    });
  };

  const handleSubmit = () => {
    const newProduct: Omit<Product, 'id' | 'uom_allowed'> & { id?: string, uom_allowed: Uom[] } = {
      id: id || undefined,
      name_en: nameEn,
      name_ta: nameTa,
      uom_allowed: Array.from(uoms),
    };
    addProduct(newProduct);
    onOpenChange(false);
    // Reset form
    setId('');
    setNameEn('');
    setNameTa('');
    setUoms(new Set());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Enter the details for the new product. Leave ID blank to auto-generate.
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
              placeholder="e.g., P10"
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
            <Label className="text-right">Allowed UOMs</Label>
            <div className="col-span-3 grid grid-cols-2 gap-4">
              {UOM_OPTIONS.map((uom) => (
                <div key={uom} className="flex items-center space-x-2">
                  <Checkbox
                    id={`uom-${uom}`}
                    checked={uoms.has(uom)}
                    onCheckedChange={(checked) =>
                      handleUomChange(uom, !!checked)
                    }
                  />
                  <Label htmlFor={`uom-${uom}`}>{uom}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            Add Product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
