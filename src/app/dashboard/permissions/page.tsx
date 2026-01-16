'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Save } from 'lucide-react';
import { Label } from '@/components/ui/label';

const roles = ['ADMIN', 'MANAGER'] as const;
type Role = typeof roles[number];

const pages = [
  'Billing',
  'Vehicle Bill',
  'Bill History',
  'Payments',
  'Customers',
  'Products',
  'Set Prices',
  'Manage Vehicles',
  'Manage Drivers',
  'Manage Users',
  'Settings',
] as const;
type Page = typeof pages[number];

const initialPermissions: Record<Role, Page[]> = {
  ADMIN: [
    'Billing',
    'Vehicle Bill',
    'Bill History',
    'Payments',
    'Customers',
    'Products',
    'Set Prices',
    'Manage Vehicles',
    'Manage Drivers',
    'Settings',
  ],
  MANAGER: ['Billing', 'Vehicle Bill', 'Bill History', 'Payments'],
};

export default function PermissionsPage() {
  const { toast } = useToast();
  const [permissions, setPermissions] =
    useState<Record<Role, Set<Page>>>(() => {
      const state: Record<Role, Set<Page>> = {
        ADMIN: new Set(initialPermissions.ADMIN),
        MANAGER: new Set(initialPermissions.MANAGER),
      };
      return state;
    });

  const handlePermissionChange = (
    role: Role,
    page: Page,
    checked: boolean
  ) => {
    setPermissions((prev) => {
      const newPermissions = new Set(prev[role]);
      if (checked) {
        newPermissions.add(page);
      } else {
        newPermissions.delete(page);
      }
      return { ...prev, [role]: newPermissions };
    });
  };

  const handleSave = () => {
    // In a real application, you would save this to your database.
    console.log('Saving permissions:', permissions);
    toast({
      title: 'Permissions Saved',
      description: 'User role permissions have been updated.',
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Manage Permissions</CardTitle>
        <CardDescription>
          Set access levels for different user roles. Only the Creator can
          modify these settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Page / Feature</TableHead>
                {roles.map((role) => (
                  <TableHead key={role} className="text-center">
                    {role.charAt(0) + role.slice(1).toLowerCase()}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page}>
                  <TableCell className="font-medium">{page}</TableCell>
                  {roles.map((role) => (
                    <TableCell key={`${role}-${page}`} className="text-center">
                      <Checkbox
                        id={`${role}-${page}`}
                        checked={permissions[role].has(page)}
                        onCheckedChange={(checked) =>
                          handlePermissionChange(role, page, !!checked)
                        }
                        aria-label={`Allow ${role} to access ${page}`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Permissions
        </Button>
      </CardFooter>
    </Card>
  );
}
