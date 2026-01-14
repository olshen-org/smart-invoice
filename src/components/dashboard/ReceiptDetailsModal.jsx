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
import { FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  // Extract file ID from various Google Drive URL formats
  const extractFileId = (url) => {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return idMatch ? idMatch[1] : null;
  };
  
  const fileId = extractFileId(receipt?.receipt_image_url);
  // Check for PDF: either ends with .pdf or has &.pdf in URL
  const isPDF = (url) => url?.includes('.pdf');
  const isReceiptPDF = isPDF(receipt?.receipt_image_url);
  
  // Google Drive direct embed URLs (no proxy needed!)
  const imageUrl = fileId 
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` 
    : receipt?.receipt_image_url;
  const pdfPreviewUrl = fileId 
    ? `https://drive.google.com/file/d/${fileId}/preview`
    : receipt?.receipt_image_url;

  return (
    <Dialog open={!!receipt} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">פרטי קבלה</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {receipt.receipt_image_url && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              {isReceiptPDF ? (
                <div className="w-full h-[600px] relative group">
                  {/* Desktop - Google Drive Preview */}
                  <iframe
                    src={pdfPreviewUrl}
                    className="w-full h-full hidden md:block rounded-xl bg-slate-100"
                    title="PDF Viewer"
                    allow="autoplay"
                  />
                  
                  {/* Mobile - Direct Link */}
                  <div className="w-full h-full md:hidden flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
                    <FileText className="w-16 h-16 text-slate-400 mb-4" />
                    <p className="text-slate-500 mb-4">לחץ לפתיחת הקובץ</p>
                    <Button
                      onClick={() => window.open(receipt.receipt_image_url, '_blank')}
                      className="bg-blue-600 text-white"
                    >
                      <ExternalLink className="w-4 h-4 ml-2" />
                      הצג מסמך
                    </Button>
                  </div>

                  {/* Desktop Overlay */}
                  <div className="absolute top-4 right-4 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="shadow-lg bg-white/90 hover:bg-white backdrop-blur-sm border border-slate-200"
                      onClick={() => window.open(receipt.receipt_image_url, '_blank')}
                    >
                      <ExternalLink className="w-4 h-4 ml-2" />
                      פתח בחלון חדש
                    </Button>
                  </div>
                </div>
              ) : (
                <img 
                  src={imageUrl} 
                  alt="Receipt" 
                  className="w-full h-auto"
                />
              )}
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