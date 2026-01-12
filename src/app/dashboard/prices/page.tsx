'use client';
import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import { Product } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import ReactSelect from 'react-select';

type LocalPrices = Record<string, string>;

export default function PricesPage() {
  const { products, productPrices, updateProductPrice } = useData();
  const { toast } = useToast();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [localPrices, setLocalPrices] = useState<LocalPrices>({});

  const selectedProduct = products.find((p) => p.id.toLowerCase() === selectedProductId.toLowerCase());

  useEffect(() => {
    if (selectedProduct) {
      const initialPrices: LocalPrices = {};
      selectedProduct.uom_allowed.forEach((uom) => {
        initialPrices[uom] = productPrices[selectedProduct.id]?.[uom]?.toString() || '';
      });
      setLocalPrices(initialPrices);
    } else {
      setLocalPrices({});
    }
  }, [selectedProduct, productPrices]);


  const handlePriceChange = (uom: string, value: string) => {
    setLocalPrices((prev) => ({ ...prev, [uom]: value }));
  };

  const handleUpdatePrices = () => {
    if (!selectedProduct) return;

    Object.entries(localPrices).forEach(([uom, priceStr]) => {
      const price = parseFloat(priceStr);
      if (!isNaN(price)) {
        updateProductPrice(selectedProduct.id, uom, price);
      }
    });

    toast({
      title: "Prices Updated",
      description: `Prices for ${selectedProduct.name_en} have been saved.`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Set Morning Prices</CardTitle>
        <CardDescription>
          Search for a product and update its price for today's market.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="product-search">Product</Label>
            <ReactSelect
              instanceId="price-product-select"
              placeholder="Select product..."
              isClearable
              options={products.map((p) => ({
                value: p.id,
                label: `${p.name_en} (${p.name_ta})`,
              }))}
              value={
                selectedProduct
                  ? {
                    value: selectedProduct.id,
                    label: `${selectedProduct.name_en} (${selectedProduct.name_ta})`,
                  }
                  : null
              }
              onChange={(option) => {
                setSelectedProductId(option ? option.value : '');
              }}
              styles={{
                menu: (base) => ({ ...base, zIndex: 50 }),
              }}
              filterOption={(option, input) =>
                option.label.toLowerCase().includes(input.toLowerCase()) ||
                option.value.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
        </div>

        {selectedProduct && (
          <div className="space-y-4 pt-4 border-t">
            <div
              key={selectedProduct.id}
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-center p-4 border rounded-lg"
            >
              <div className="md:col-span-1 lg:col-span-2">
                <p className="font-medium">
                  {selectedProduct.name_en} / {selectedProduct.name_ta}
                </p>
                <p className="text-sm text-muted-foreground">
                  ID: {selectedProduct.id}
                </p>
              </div>
              {selectedProduct.uom_allowed.map((uom) => (
                <div className="grid gap-2" key={uom}>
                  <Label htmlFor={`${selectedProduct.id}-${uom}`}>
                    Price per {uom} (₹)
                  </Label>
                  <Input
                    id={`${selectedProduct.id}-${uom}`}
                    type="number"
                    placeholder="0.00"
                    value={localPrices[uom] || ''}
                    onChange={(e) => handlePriceChange(uom, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            size="lg"
            disabled={!selectedProduct}
            onClick={handleUpdatePrices}
          >
            <Save className="mr-2 h-4 w-4" />
            Update Prices
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
