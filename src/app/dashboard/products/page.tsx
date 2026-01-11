import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { products } from '@/lib/data';
  import { Button } from '@/components/ui/button';
  import { PlusCircle } from 'lucide-react';
  
  export default function ProductsPage() {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="font-headline">Products</CardTitle>
                <CardDescription>
                Manage your products and their allowed units of measure.
                </CardDescription>
            </div>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4"/>
                New Product
            </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name (English)</TableHead>
                <TableHead>Name (Tamil)</TableHead>
                <TableHead>Allowed UOMs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.id}</TableCell>
                  <TableCell>{product.name_en}</TableCell>
                  <TableCell>{product.name_ta}</TableCell>
                  <TableCell>{product.uom_allowed.join(', ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }
  