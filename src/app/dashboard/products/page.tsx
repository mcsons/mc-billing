'use client';
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
import { Button } from '@/components/ui/button';
import { Edit, PlusCircle, Trash2 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { AddProductDialog } from '@/components/dashboard/add-product-dialog';
import { useState } from 'react';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import { Product } from '@/lib/data';

export default function ProductsPage() {
  const { products, deleteProduct } = useData();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const showAlertDialog = useAlertDialog();

  const handleEdit = (product: Product) => {
    setProductToEdit(product);
    setIsEditDialogOpen(true);
  };
  
  const handleCloseDialogs = () => {
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setProductToEdit(null);
  };

  const handleDelete = (productId: string, productName: string) => {
    showAlertDialog({
      title: 'Are you sure?',
      description: `This will permanently delete the product "${productName}". This action cannot be undone.`,
      onConfirm: () => deleteProduct(productId),
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="font-headline">Products</CardTitle>
            <CardDescription>
              Manage your products and their allowed units of measure.
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Product
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name (English)</TableHead>
                  <TableHead>Name (Tamil)</TableHead>
                  <TableHead>Allowed UOMs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.id}</TableCell>
                    <TableCell>{product.name_en}</TableCell>
                    <TableCell>{product.name_ta}</TableCell>
                    <TableCell>{product.uom_allowed.join(', ')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit product</span>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id, product.name_en)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Delete product</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AddProductDialog
        isOpen={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={handleCloseDialogs}
        productToEdit={productToEdit}
      />
    </>
  );
}
