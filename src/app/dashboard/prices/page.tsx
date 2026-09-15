'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Save, Eraser } from 'lucide-react';
import { Product } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import ReactSelect from 'react-select';
import { useAlertDialog } from '@/context/AlertDialogProvider';

type LocalPrices = Record<string, string>;

export default function PricesPage() {
  const {
    products,
    customers,
    productPrices,
    updateProductPrice,
    customerProductPrices,
    setCustomerProductPrice,
    getCustomerProductPrice,
    clearCustomerProductPrice,
  } = useData();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [localPrices, setLocalPrices] = useState<LocalPrices>({});
  const [isClearing, setIsClearing] = useState(false);

  const productSearchRef = useRef<any>(null);
  const customerSearchRef = useRef<any>(null);

  const selectedProduct = products.find(
    (p) => p.id.toLowerCase() === selectedProductId.toLowerCase()
  );
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  // ── Shared ReactSelect styles (identical to billing page) ───────────────
  const reactSelectStyles: any = {
    container: (base: any) => ({ ...base, width: '100%' }),
    control: (base: any, state: any) => ({
      ...base,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      minHeight: '44px',
      '&:hover': { borderColor: 'hsl(var(--ring))' },
    }),
    menu: (base: any) => ({
      ...base,
      backgroundColor: 'hsl(var(--card))',
      zIndex: 50,
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected
        ? 'hsl(var(--primary))'
        : state.isFocused
        ? 'hsl(var(--primary) / 0.15)'
        : 'transparent',
      color: state.isSelected
        ? 'hsl(var(--primary-foreground))'
        : 'hsl(var(--foreground))',
      '&:active': { backgroundColor: 'hsl(var(--primary))' },
    }),
    singleValue: (base: any) => ({ ...base, color: 'hsl(var(--foreground))' }),
    input: (base: any) => ({ ...base, color: 'hsl(var(--foreground))' }),
    placeholder: (base: any) => ({
      ...base,
      color: 'hsl(var(--muted-foreground))',
    }),
  };

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: `${p.name_en} (${p.name_ta})`,
      })),
    [products]
  );

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: `${c.name_en} (${c.name_ta})`,
      })),
    [customers]
  );

  // Recompute local price inputs whenever product or customer changes
  useEffect(() => {
    if (!selectedProduct) {
      setLocalPrices({});
      return;
    }
    const prices: LocalPrices = {};
    selectedProduct.uom_allowed.forEach((uom) => {
      if (selectedCustomerId) {
        // Customer-specific price (if exists), else fall back to default
        const custPrice = getCustomerProductPrice(selectedCustomerId, selectedProduct.id, uom);
        prices[uom] =
          custPrice !== undefined
            ? custPrice.toString()
            : (productPrices[selectedProduct.id]?.[uom]?.toString() || '1');
      } else {
        prices[uom] = productPrices[selectedProduct.id]?.[uom]?.toString() || '1';
      }
    });
    setLocalPrices(prices);
  }, [selectedProduct, selectedCustomerId, productPrices, getCustomerProductPrice]);

  // ── Helpers ─────────────────────────────────────────────────────────────

  const handlePriceChange = (uom: string, value: string) => {
    setLocalPrices((prev) => ({ ...prev, [uom]: value }));
  };

  const handleUpdatePrices = async () => {
    if (!selectedProduct) return;

    const entries = Object.entries(localPrices);
    const valid = entries.filter(([, v]) => !isNaN(parseFloat(v)));

    for (const [uom, priceStr] of valid) {
      const price = parseFloat(priceStr);
      if (selectedCustomerId) {
        // Save customer-specific price
        await setCustomerProductPrice(selectedCustomerId, selectedProduct.id, uom, price);
      } else {
        // Save default price
        updateProductPrice(selectedProduct.id, uom, price);
      }
    }

    const scope = selectedCustomer
      ? `for ${selectedCustomer.name_en}`
      : '(Default)';

    toast({
      title: 'Prices Updated',
      description: `${selectedProduct.name_en} prices saved ${scope}.`,
    });

    // Reset
    setSelectedProductId('');
    setSelectedCustomerId('');
    setLocalPrices({});
    productSearchRef.current?.clearValue();
    customerSearchRef.current?.clearValue();
    setTimeout(() => productSearchRef.current?.focus(), 0);
  };

  // ── Customer-specific price clearing ────────────────────────────────────
  // UOMs of the selected product that currently carry a customer-specific
  // override. Empty means there is nothing to clear (so no Firestore write).
  const overriddenUoms = useMemo(() => {
    if (!selectedProduct || !selectedCustomerId) return [];
    return selectedProduct.uom_allowed.filter(
      (uom) => getCustomerProductPrice(selectedCustomerId, selectedProduct.id, uom) !== undefined
    );
  }, [selectedProduct, selectedCustomerId, getCustomerProductPrice]);

  const hasCustomerSpecificPrice = overriddenUoms.length > 0;

  const handleClearCustomerPrice = () => {
    if (!selectedProduct || !selectedCustomer || !hasCustomerSpecificPrice) return;

    showAlertDialog({
      title: 'Clear Customer Specific Price?',
      description: `Clear the customer-specific price for ${selectedCustomer.name_en} and ${selectedProduct.name_en}? They will go back to the default product price. Existing bills are not changed.`,
      confirmText: 'Clear Price',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setIsClearing(true);
        try {
          const removed = await clearCustomerProductPrice(
            selectedCustomer.id,
            selectedProduct.id,
            overriddenUoms
          );
          if (removed === 0) {
            toast({
              title: 'No customer-specific price is set.',
              description: `${selectedCustomer.name_en} already uses the default price for ${selectedProduct.name_en}.`,
            });
            return;
          }
          toast({
            title: 'Customer Price Cleared',
            description: `${selectedProduct.name_en} now uses the default price for ${selectedCustomer.name_en}.`,
          });
          // Selections are intentionally kept: the live customerProductPrices
          // listener refreshes the displayed price to the default on its own.
        } catch {
          toast({
            variant: 'destructive',
            title: 'Could Not Clear Price',
            description: 'The customer-specific price was not changed. Please try again.',
          });
        } finally {
          setIsClearing(false);
        }
      },
    });
  };

  // ── Current-price label per UOM ─────────────────────────────────────────
  const getPriceLabel = (uom: string) => {
    if (!selectedProduct) return null;
    if (selectedCustomerId) {
      const custPrice = getCustomerProductPrice(selectedCustomerId, selectedProduct.id, uom);
      if (custPrice !== undefined) {
        return { label: 'Customer Specific', price: custPrice, variant: 'default' as const };
      }
    }
    const defaultPrice = productPrices[selectedProduct.id]?.[uom];
    if (defaultPrice !== undefined) {
      return { label: 'Default', price: defaultPrice, variant: 'secondary' as const };
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Set Morning Prices</CardTitle>
        <CardDescription>
          Search for a product and update its price. Optionally select a customer to
          set a customer-specific price.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Selectors row ─────────────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Product */}
          <div className="grid gap-2">
            <Label htmlFor="product-search">Product</Label>
            <ReactSelect
              ref={productSearchRef}
              instanceId="price-product-select"
              placeholder="Select product..."
              isClearable
              options={productOptions}
              value={
                selectedProduct
                  ? { value: selectedProduct.id, label: `${selectedProduct.name_en} (${selectedProduct.name_ta})` }
                  : null
              }
              onChange={(option) => {
                setSelectedProductId(option ? option.value : '');
              }}
              styles={reactSelectStyles}
              filterOption={(option, input) =>
                option.label.toLowerCase().includes(input.toLowerCase()) ||
                option.value.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* Customer (optional) */}
          <div className="grid gap-2">
            <Label htmlFor="customer-search">
              Customer{' '}
              <span className="text-muted-foreground font-normal text-xs">(Optional)</span>
            </Label>
            <ReactSelect
              ref={customerSearchRef}
              instanceId="price-customer-select"
              placeholder="All customers (default price)..."
              isClearable
              options={customerOptions}
              value={
                selectedCustomer
                  ? { value: selectedCustomer.id, label: `${selectedCustomer.name_en} (${selectedCustomer.name_ta})` }
                  : null
              }
              onChange={(option) => {
                setSelectedCustomerId(option ? option.value : '');
              }}
              styles={reactSelectStyles}
              filterOption={(option, input) =>
                option.label.toLowerCase().includes(input.toLowerCase()) ||
                option.value.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
        </div>

        {/* ── Price editing area ────────────────────────────────────────── */}
        {selectedProduct && (
          <div className="space-y-4 pt-4 border-t">
            <div
              key={selectedProduct.id}
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start p-4 border rounded-lg"
            >
              {/* Product name */}
              <div className="md:col-span-1 lg:col-span-2">
                <p className="font-medium">
                  {selectedProduct.name_en} / {selectedProduct.name_ta}
                </p>
                <p className="text-sm text-muted-foreground">ID: {selectedProduct.id}</p>
                {selectedCustomer && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    Customer: {selectedCustomer.name_en}
                  </Badge>
                )}
              </div>

              {/* Price inputs per UOM */}
              {selectedProduct.uom_allowed.map((uom) => {
                const priceInfo = getPriceLabel(uom);
                return (
                  <div className="grid gap-2" key={uom}>
                    <Label htmlFor={`${selectedProduct.id}-${uom}`}>
                      Price per {uom} (₹)
                    </Label>
                    {priceInfo && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge
                          variant={priceInfo.variant}
                          className="text-xs py-0 px-1.5"
                        >
                          {priceInfo.label}
                        </Badge>
                        <span>Current: ₹{priceInfo.price}</span>
                      </div>
                    )}
                    <Input
                      id={`${selectedProduct.id}-${uom}`}
                      type="number"
                      placeholder="0.00"
                      value={localPrices[uom] || ''}
                      onChange={(e) => handlePriceChange(uom, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {selectedProduct && selectedCustomer && (
            <Button
              size="lg"
              variant="outline"
              className="w-full min-h-[44px] border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              disabled={!hasCustomerSpecificPrice || isClearing}
              onClick={handleClearCustomerPrice}
              title={
                hasCustomerSpecificPrice
                  ? 'Remove this customer-specific price'
                  : 'No customer-specific price is set.'
              }
            >
              <Eraser className="mr-2 h-4 w-4" />
              {isClearing ? 'Clearing...' : 'Clear Customer Specific Price'}
            </Button>
          )}
          <Button
            size="lg"
            className="w-full min-h-[44px] sm:w-auto"
            disabled={!selectedProduct}
            onClick={handleUpdatePrices}
          >
            <Save className="mr-2 h-4 w-4" />
            {selectedCustomer ? 'Update Customer Price' : 'Update Default Price'}
          </Button>
        </div>
        {selectedProduct && selectedCustomer && !hasCustomerSpecificPrice && (
          <p className="text-xs text-muted-foreground text-right">
            No customer-specific price is set — {selectedCustomer.name_en} uses the default price.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
