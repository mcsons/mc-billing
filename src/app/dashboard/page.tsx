'use client';
import {
  ArrowRight,
  ClipboardList,
  Clock,
  FileText,
  IndianRupee,
  Tag,
  X,
  Users2,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useData } from '@/context/DataContext';

export default function DashboardPage() {
  const router = useRouter();
  const { dashboardStats, currentUser } = useData();
  const [showAllProducts, setShowAllProducts] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const {
    todaySales = 0,
    salesChange = 0,
    todayBills = 0,
    billsChange = 0,
    totalPendingBalance = 0,
    todayPaymentsTotal = 0,
    recentBills = [],
    topProducts = [],
    allProductsToday = [],
  } = dashboardStats || {};


  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline text-gray-900 dark:text-white">
            {getGreeting()}, {currentUser?.username || 'M.C.'}!
          </h1>
          <p className="text-muted-foreground">
            Here’s what’s happening today at M.C & Sons
          </p>
        </div>
        <Button onClick={() => router.push('/dashboard/billing')}>
          + New Bill
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Today's Sales
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20 text-green-600">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{todaySales.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              {salesChange >= 0 ? '+' : ''}
              {salesChange.toFixed(2)}% vs yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bills Created</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-600">
              <FileText className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayBills}</div>
            <p className="text-xs text-muted-foreground">
              {billsChange >= 0 ? '+' : ''}
              {billsChange.toFixed(0)} vs yesterday
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Balance
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 text-orange-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{totalPendingBalance.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
              Total outstanding amount
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
            Today&apos;s Payments
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-600">
            <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
          <div className="text-2xl font-bold">
              ₹{todayPaymentsTotal.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-muted-foreground">
            Total payments received today
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Recent Bills</CardTitle>
              <CardDescription>Latest transactions from today.</CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1">
              <Link href="/dashboard/history">
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentBills.length > 0 ? (
                recentBills.map((bill) => (
                  <div key={bill.billNo} className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="grid gap-1 flex-1">
                      <p className="text-sm font-medium leading-none">
                        {bill.customerName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {bill.billNo}
                      </p>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="font-medium">
                        ₹{bill.amount.toLocaleString('en-IN')}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        Finalized
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No bills created yet today.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Top Products Today</CardTitle>
              <CardDescription>Most sold items by quantity.</CardDescription>
            </div>
            <Button
              size="sm"
              className="ml-auto gap-1"
              onClick={() => setShowAllProducts(true)}
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-6">
            {topProducts.length > 0 ? (
              topProducts.map((product, index) => (
                <div
                  key={product.productId}
                  className="flex items-center gap-4"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div className="grid gap-1 flex-1">
                    <p className="text-sm font-medium leading-none">
                      {product.productName}
                    </p>
                    <div className="flex items-center gap-2">
                      <Progress value={product.percentage} className="h-2" />
                    </div>
                  </div>
                  <div className="font-medium">
                    {product.totalQty.toFixed(2)} {product.uom}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No sales recorded yet today.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View All Products Modal */}
      {showAllProducts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowAllProducts(false)}
        >
          <div
            className="relative bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
              <h2 className="text-lg font-bold text-foreground">All Products Today</h2>
                <p className="text-sm text-muted-foreground">
                  Sorted by highest quantity sold
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={() => setShowAllProducts(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1 p-6">
              {allProductsToday.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="pb-3 font-medium">#</th>
                      <th className="pb-3 font-medium">Product</th>
                      <th className="pb-3 font-medium text-right">Total Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {allProductsToday.map((product, index) => (
                      <tr key={product.productId} className="hover:bg-muted/40">
                        <td className="py-3 pr-3 text-muted-foreground font-medium">
                          {index + 1}
                        </td>
                        <td className="py-3 font-medium">
                          {product.productName}
                        </td>
                        <td className="py-3 text-right font-mono font-semibold">
                          {product.totalQty % 1 === 0
                            ? product.totalQty.toFixed(0)
                            : product.totalQty.toFixed(2)}{' '}
                          {product.uom}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No sales recorded today.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button
            variant="outline"
            size="lg"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => router.push('/dashboard/billing')}
          >
            <ClipboardList className="h-6 w-6" />
            <span>Create Bill</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => router.push('/dashboard/payments')}
          >
            <Wallet className="h-6 w-6" />
            <span>Record Payment</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => router.push('/dashboard/prices')}
          >
            <Tag className="h-6 w-6" />
            <span>Update Prices</span>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => router.push('/dashboard/customers')}
          >
            <Users2 className="h-6 w-6" />
            <span>Customers</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
