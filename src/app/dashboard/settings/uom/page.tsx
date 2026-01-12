'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useData } from '@/context/DataContext';
import { PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export default function UomSettingsPage() {
  const { uoms, addUom } = useData();
  const { toast } = useToast();
  const [newUom, setNewUom] = useState('');

  const handleAddUom = () => {
    if (newUom.trim() === '') {
      toast({
        variant: 'destructive',
        title: 'Invalid UOM',
        description: 'UOM name cannot be empty.',
      });
      return;
    }
    if (uoms.includes(newUom.toUpperCase())) {
        toast({
            variant: 'destructive',
            title: 'UOM Exists',
            description: `The UOM "${newUom.toUpperCase()}" already exists.`,
        });
        return;
    }

    addUom(newUom.toUpperCase());
    toast({
        title: 'UOM Added',
        description: `Successfully added "${newUom.toUpperCase()}".`,
    });
    setNewUom('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Manage Units of Measure (UOM)</CardTitle>
        <CardDescription>
          Add or view the units of measure available for products.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
            <h3 className="font-medium mb-4">Existing UOMs</h3>
            <div className="flex flex-wrap gap-2">
                {uoms.map((uom) => (
                    <Badge key={uom} variant="secondary" className="text-base">
                        {uom}
                    </Badge>
                ))}
            </div>
        </div>
        <div className="space-y-2">
            <h3 className="font-medium">Add New UOM</h3>
            <div className="flex items-center gap-2">
                <Input
                    id="new-uom"
                    placeholder="e.g., PACKET"
                    value={newUom}
                    onChange={(e) => setNewUom(e.target.value)}
                />
                <Button onClick={handleAddUom}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
