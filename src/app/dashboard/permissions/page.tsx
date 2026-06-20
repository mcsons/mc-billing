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
import { useData } from '@/context/DataContext';

import { useEffect } from 'react';
import { Role, Page, initialPermissions, roles, pages } from '@/lib/data';
export default function PermissionsPage() {
  const { toast } = useToast();
  const { currentUser, rolePermissions, updateRolePermissions } = useData();
  const canEdit = currentUser?.role === 'CREATOR';

  const [permissions, setPermissions] =
    useState<Record<Role, Set<Page>>>(() => {
      const state: Record<Role, Set<Page>> = {
        CREATOR: new Set(rolePermissions.CREATOR || initialPermissions.CREATOR),
        ADMIN: new Set(rolePermissions.ADMIN || initialPermissions.ADMIN),
        MANAGER: new Set(rolePermissions.MANAGER || initialPermissions.MANAGER),
        BOX: new Set(rolePermissions.BOX || initialPermissions.BOX),
      };
      return state;
    });

  useEffect(() => {
    setPermissions({
        CREATOR: new Set(rolePermissions.CREATOR || initialPermissions.CREATOR),
        ADMIN: new Set(rolePermissions.ADMIN || initialPermissions.ADMIN),
        MANAGER: new Set(rolePermissions.MANAGER || initialPermissions.MANAGER),
        BOX: new Set(rolePermissions.BOX || initialPermissions.BOX),
    });
  }, [rolePermissions]);

  const handlePermissionChange = (
    role: Role,
    page: Page,
    checked: boolean
  ) => {
    if (!canEdit) return;
    // Creator permissions cannot be changed.
    if (role === 'CREATOR') return;

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

  const handleSave = async () => {
    const toSave = {
      CREATOR: Array.from(permissions.CREATOR),
      ADMIN: Array.from(permissions.ADMIN),
      MANAGER: Array.from(permissions.MANAGER),
      BOX: Array.from(permissions.BOX),
    };
    await updateRolePermissions(toSave);
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
                        disabled={!canEdit || role === 'CREATOR'}
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
        <Button onClick={handleSave} disabled={!canEdit}>
          <Save className="mr-2 h-4 w-4" />
          Save Permissions
        </Button>
      </CardFooter>
    </Card>
  );
}
