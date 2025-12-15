import React from 'react';
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Calendar, CreditCard, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

const categoryColors = {
  office_supplies: "bg-blue-100 text-blue-800 border-blue-200",
  utilities: "bg-green-100 text-green-800 border-green-200",
  travel: "bg-purple-100 text-purple-800 border-purple-200",
  meals: "bg-orange-100 text-orange-800 border-orange-200",
  equipment: "bg-red-100 text-red-800 border-red-200",
  services: "bg-indigo-100 text-indigo-800 border-indigo-200",
  rent: "bg-yellow-100 text-yellow-800 border-yellow-200",
  insurance: "bg-pink-100 text-pink-800 border-pink-200",
  marketing: "bg-cyan-100 text-cyan-800 border-cyan-200",
  other: "bg-gray-100 text-gray-800 border-gray-200"
};

const categoryLabels = {
  office_supplies: "ציוד משרדי",
  utilities: "שירותים",
  travel: "נסיעות",
  meals: "ארוחות",
  equipment: "ציוד",
  services: "שירותים מקצועיים",
  rent: "שכירות",
  insurance: "ביטוח",
  marketing: "שיווק",
  other: "אחר"
};

export default function ReceiptsList({ receipts, batches, isLoading, onSelectReceipt }) {
  const batchMap = React.useMemo(() => {
    if (!batches) return {};
    return batches.reduce((acc, b) => {
      acc[b.id] = b.batch_name;
      return acc;
    }, {});
  }, [batches]);

  return (
    <Card className="border-none shadow-2xl shadow-slate-200/50">
      <CardHeader className="p-6 border-b border-slate-100">
        <CardTitle className="text-xl font-bold">קבלות אחרונות</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="text-right font-semibold">ספק</TableHead>
                <TableHead className="text-right font-semibold hidden md:table-cell">תאריך</TableHead>
                <TableHead className="text-right font-semibold">סכום</TableHead>
                <TableHead className="text-right font-semibold hidden md:table-cell">קטגוריה</TableHead>
                <TableHead className="text-right font-semibold">כרטיס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : receipts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                    אין קבלות עדיין. העלה את הקבלה הראשונה!
                  </TableCell>
                </TableRow>
              ) : (
                receipts.map((receipt) => (
                  <TableRow 
                    key={receipt.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => onSelectReceipt(receipt)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{receipt.vendor_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(receipt.date), "d MMMM yyyy", { locale: he })}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-slate-900">
                      ₪{receipt.total_amount?.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {receipt.category && (
                        <Badge 
                          variant="secondary"
                          className={`${categoryColors[receipt.category]} border font-medium`}
                        >
                          {categoryLabels[receipt.category]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-600">
                         <Layers className="w-4 h-4" />
                         <span className="text-sm">{batchMap[receipt.batch_id] || '-'}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}