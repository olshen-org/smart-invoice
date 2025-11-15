import React from 'react';
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

const paymentMethodLabels = {
  cash: "מזומן",
  credit_card: "כרטיס אשראי",
  bank_transfer: "העברה בנקאית",
  check: "צ'ק",
  other: "אחר"
};

export default function ReceiptDetailsModal({ receipt, onClose }) {
  return (
    <Dialog open={!!receipt} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">פרטי קבלה</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {receipt.receipt_image_url && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <img 
                src={receipt.receipt_image_url} 
                alt="Receipt" 
                className="w-full h-auto"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-1">ספק</p>
              <p className="font-bold text-lg">{receipt.vendor_name}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-1">מספר קבלה</p>
              <p className="font-bold text-lg">{receipt.receipt_number || '-'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-1">תאריך</p>
              <p className="font-bold text-lg">
                {format(new Date(receipt.date), "d MMMM yyyy", { locale: he })}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-1">אמצעי תשלום</p>
              <p className="font-bold text-lg">
                {receipt.payment_method ? paymentMethodLabels[receipt.payment_method] : '-'}
              </p>
            </div>
          </div>

          {receipt.category && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-2">קטגוריה</p>
              <Badge className="text-base px-4 py-1">
                {categoryLabels[receipt.category]}
              </Badge>
            </div>
          )}

          {receipt.line_items && receipt.line_items.length > 0 && (
            <div>
              <h3 className="font-bold text-lg mb-3">פירוט פריטים</h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-right font-bold">תיאור</TableHead>
                      <TableHead className="text-right font-bold">כמות</TableHead>
                      <TableHead className="text-right font-bold">מחיר יחידה</TableHead>
                      <TableHead className="text-right font-bold">סה״כ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipt.line_items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>₪{item.unit_price?.toFixed(2)}</TableCell>
                        <TableCell className="font-bold">₪{item.total?.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <Separator />

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 space-y-3">
            {receipt.vat_amount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-700 font-medium">מע״ם:</span>
                <span className="text-lg font-bold text-slate-900">
                  ₪{receipt.vat_amount?.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-xl">
              <span className="text-slate-900 font-bold">סה״כ לתשלום:</span>
              <span className="text-2xl font-bold text-blue-700">
                ₪{receipt.total_amount?.toLocaleString('he-IL', {minimumFractionDigits: 2})}
              </span>
            </div>
          </div>

          {receipt.notes && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500 mb-2">הערות</p>
              <p className="text-slate-700">{receipt.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}