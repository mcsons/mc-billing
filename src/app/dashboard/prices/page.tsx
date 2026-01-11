import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { products } from '@/lib/data';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  
  export default function PricesPage() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Set Morning Prices</CardTitle>
          <CardDescription>
            Update the prices for all products for today's market.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-center p-4 border rounded-lg">
                <div className="md:col-span-1 lg:col-span-2">
                    <p className="font-medium">{product.name_en} / {product.name_ta}</p>
                    <p className="text-sm text-muted-foreground">ID: {product.id}</p>
                </div>
                {product.uom_allowed.map(uom => (
                    <div className="grid gap-2" key={uom}>
                        <Label htmlFor={`${product.id}-${uom}`}>Price per {uom} (₹)</Label>
                        <Input id={`${product.id}-${uom}`} type="number" placeholder="0.00" />
                    </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="lg">Update Prices</Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  