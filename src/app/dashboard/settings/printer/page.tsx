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
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import { Switch } from '@/components/ui/switch';
  import { Separator } from '@/components/ui/separator';
  import { Printer } from 'lucide-react';
  
  export default function PrinterSettingsPage() {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Printer Settings</CardTitle>
          <CardDescription>
            Configure the settings for 79mm thermal bill printing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="paper-width">Paper Width</Label>
                    <Input id="paper-width" defaultValue="79mm" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="font-family">Tamil-compatible Font</Label>
                    <Select defaultValue="default_tamil_font">
                        <SelectTrigger>
                        <SelectValue placeholder="Select font" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="default_tamil_font">Default Tamil Font</SelectItem>
                        <SelectItem value="another_font">Another Font</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="font-size">Font Size</Label>
                    <Input id="font-size" type="number" defaultValue="12" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="line-spacing">Line Spacing</Label>
                    <Input id="line-spacing" type="number" defaultValue="1.5" step="0.1" />
                </div>
            </div>

            <Separator />
            
            <div>
                <h3 className="text-lg font-medium mb-4">Visibility Settings</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="show-prev-balance" className="flex flex-col space-y-1">
                            <span>Show Previous Balance</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Display the customer's previous balance on the bill.
                            </span>
                        </Label>
                        <Switch id="show-prev-balance" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="show-paid-amount" className="flex flex-col space-y-1">
                            <span>Show Paid Amount</span>
                             <span className="font-normal leading-snug text-muted-foreground">
                                Display the amount paid for the current transaction.
                            </span>
                        </Label>
                        <Switch id="show-paid-amount" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <Label htmlFor="show-remaining-balance" className="flex flex-col space-y-1">
                            <span>Show Remaining Balance</span>
                             <span className="font-normal leading-snug text-muted-foreground">
                                Display the customer's final outstanding balance.
                            </span>
                        </Label>
                        <Switch id="show-remaining-balance" defaultChecked />
                    </div>
                </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4 flex justify-between">
          <Button variant="outline">
            <Printer className="mr-2 h-4 w-4" />
            Test Print
          </Button>
          <Button>Save Settings</Button>
        </CardFooter>
      </Card>
    );
  }
  