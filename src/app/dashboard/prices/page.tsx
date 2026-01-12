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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronsUpDown, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';

type LocalPrices = Record<string, string>;

export default function PricesPage() {
  const { products, productPrices, updateProductPrice } = useData();
  const { toast } = useToast();
  const [productPopoverOpen, setProductPopoverOpen] = useState(false);
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

  const handleProductSelect = (productId: string) => {
    setSelectedProductId(productId === selectedProductId ? '' : productId);
    setProductPopoverOpen(false);
  };

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
            <Popover
              open={productPopoverOpen}
              onOpenChange={setProductPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productPopoverOpen}
                  className="w-full justify-between"
                >
                  {selectedProduct
                    ? `${selectedProduct.name_en} (${selectedProduct.name_ta})`
                    : 'Select product...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search product..." />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={`${product.name_en} ${product.name_ta} ${product.id}`}
                          onSelect={() => handleProductSelect(product.id)}
                          onClick={() => handleProductSelect(product.id)}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedProductId.toLowerCase() === product.id.toLowerCase()
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {product.name_en} ({product.name_ta})
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
