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
import { Checkbox } from '@/components/ui/checkbox';
import { useData } from '@/context/DataContext';
import { Product, Uom } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

interface AddProductDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  productToEdit?: Product | null;
}

export function AddProductDialog({
  isOpen,
  onOpenChange,
  productToEdit,
}: AddProductDialogProps) {
  const { addProduct, editProduct, uoms: UOM_OPTIONS } = useData();
  const { toast } = useToast();
  
  const [id, setId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [uoms, setUoms] = useState<Set<Uom>>(new Set());

  const isEditing = !!productToEdit;

  useEffect(() => {
    if (isEditing && productToEdit) {
      setId(productToEdit.id);
      setNameEn(productToEdit.name_en);
      setNameTa(productToEdit.name_ta);
      setUoms(new Set(productToEdit.uom_allowed as Uom[]));
    } else {
      // Reset for "Add New" mode
      setId('');
      setNameEn('');
      setNameTa('');
      setUoms(new Set());
    }
  }, [productToEdit, isEditing, isOpen]);


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
    const productData = {
      name_en: nameEn,
      name_ta: nameTa,
      uom_allowed: Array.from(uoms),
    };

    if (isEditing) {
      editProduct(id, productData);
      toast({ title: 'Product Updated', description: `"${nameEn}" has been updated.` });
    } else {
       const newProduct: Omit<Product, 'id'> & { id?: string } = {
        id: id || undefined,
        ...productData
      };
      addProduct(newProduct);
      toast({ title: 'Product Added', description: `"${nameEn}" has been added.` });
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            {isEditing 
              ? `Editing details for ${productToEdit?.name_en}.`
              : 'Enter the details for the new product. Leave ID blank to auto-generate.'
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
             <Label htmlFor="id" className="text-right">
              ID
            </Label>
            <Input
              id="id"
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              className="col-span-3"
              placeholder={isEditing ? '' : 'e.g., P10 (Optional)'}
              disabled={isEditing}
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
              disabled={isEditing}
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
               disabled={isEditing}
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Allowed UOMs</Label>
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
            {isEditing ? 'Save Changes' : 'Add Product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
