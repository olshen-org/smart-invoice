import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, CheckCircle, XCircle, Calculator, ExternalLink, Loader2, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const CATEGORIES = [
  { value: "office_supplies", label: "ציוד משרדי" },
  { value: "utilities", label: "שירותים" },
  { value: "travel", label: "נסיעות" },
  { value: "meals", label: "ארוחות" },
  { value: "equipment", label: "ציוד" },
  { value: "services", label: "שירותים מקצועיים" },
  { value: "rent", label: "שכירות" },
  { value: "insurance", label: "ביטוח" },
  { value: "marketing", label: "שיווק" },
  { value: "other", label: "אחר" }
];

const PAYMENT_METHODS = [
  { value: "cash", label: "מזומן" },
  { value: "credit_card", label: "כרטיס אשראי" },
  { value: "bank_transfer", label: "העברה בנקאית" },
  { value: "check", label: "צ'ק" },
  { value: "other", label: "אחר" }
];

export default function ReceiptReviewModal({ receipt, onApprove, onReject, onClose, isProcessing }) {
  const [editedData, setEditedData] = useState(receipt);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  useEffect(() => {
    setEditedData(receipt);
  }, [receipt]);

  // Helper to check for PDF
  const isPDF = (url) => url?.toLowerCase().endsWith('.pdf');
  const isReceiptPDF = isPDF(editedData.receipt_image_url);

  useEffect(() => {
    let objectUrl = null;

    if (isReceiptPDF && editedData.receipt_image_url) {
      setIsLoadingPdf(true);
      setPdfBlobUrl(null);
      
      // Fetch the PDF file directly from storage
      fetch(editedData.receipt_image_url)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
          const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
          objectUrl = URL.createObjectURL(blob);
          setPdfBlobUrl(objectUrl);
        })
        .catch(err => {
          console.error("Error loading PDF:", err);
          setPdfBlobUrl(null);
        })
        .finally(() => setIsLoadingPdf(false));
    } else {
       setPdfBlobUrl(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [editedData.receipt_image_url, isReceiptPDF]);

  const handleInputChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...(editedData.line_items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'description' ? value : parseFloat(value) || 0,
    };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = (newItems[index].quantity || 0) * (newItems[index].unit_price || 0);
    }

    setEditedData(prev => ({ ...prev, line_items: newItems }));
  };

  const addNewItem = () => {
    setEditedData(prev => ({
      ...prev,
      line_items: [...(prev.line_items || []), {
        description: '',
        quantity: 1,
        unit_price: 0,
        total: 0
      }]
    }));
  };

  const removeItem = (index) => {
    setEditedData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotals = () => {
    const itemsTotal = (editedData.line_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
    setEditedData(prev => ({ ...prev, total_amount: itemsTotal }));
  };

  return (
    <Dialog open={!!receipt} onOpenChange={onClose}>
      <DialogContent className="w-full h-full md:max-w-6xl md:h-[95vh] max-w-none m-0 rounded-none md:rounded-xl p-4 md:p-6" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl font-bold">אישור קבלה</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(100vh-100px)] md:max-h-[calc(95vh-120px)]">
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 p-1 pb-20 md:pb-1">
            {/* Image/PDF Preview */}
            <div className="space-y-4 order-2 lg:order-1">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 min-h-[300px] lg:min-h-[500px] flex items-center justify-center">
              {isReceiptPDF ? (
                isLoadingPdf ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sm text-slate-500">טוען קובץ...</p>
                  </div>
                ) : pdfBlobUrl ? (
                  <div className="w-full h-[600px] relative group">
                     {/* Desktop View - Iframe */}
                     <iframe
                        src={pdfBlobUrl}
                        className="w-full h-full hidden md:block rounded-xl bg-slate-100"
                        title="PDF Viewer"
                     />
                     
                     {/* Mobile View - Button */}
                     <div className="w-full h-full md:hidden flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-8 text-center">
                         <FileText className="w-16 h-16 text-slate-400 mb-4" />
                         <p className="text-slate-500 mb-4">לחץ לפתיחת הקובץ</p>
                         <Button
                             onClick={() => window.open(pdfBlobUrl, '_blank')}
                             className="bg-blue-600 text-white"
                         >
                             <ExternalLink className="w-4 h-4 ml-2" />
                             הצג מסמך
                         </Button>
                     </div>

                     {/* Desktop Overlay Button */}
                     <div className="absolute top-4 right-4 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="shadow-lg bg-white/90 hover:bg-white backdrop-blur-sm border border-slate-200"
                            onClick={() => window.open(pdfBlobUrl, '_blank')}
                        >
                            <ExternalLink className="w-4 h-4 ml-2" />
                            פתח בחלון חדש
                        </Button>
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                     <p className="text-red-500">שגיאה בטעינת הקובץ</p>
                     <Button
                      variant="outline"
                      onClick={() => window.open(editedData.receipt_image_url, '_blank')}
                      className="gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      נסה לפתוח קישור ישיר
                    </Button>
                  </div>
                )
              ) : (
                <img 
                  src={editedData.receipt_image_url} 
                  alt="Receipt" 
                  className="w-full h-auto max-h-[600px] object-contain"
                />
              )}
              </div>
            </div>

            {/* Editable Form */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">שם הספק *</Label>
                  <Input
                    value={editedData.vendor_name || ''}
                    onChange={(e) => handleInputChange('vendor_name', e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">מספר קבלה</Label>
                  <Input
                    value={editedData.receipt_number || ''}
                    onChange={(e) => handleInputChange('receipt_number', e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">תאריך *</Label>
                  <Input
                    type="date"
                    value={editedData.date || ''}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">קטגוריה</Label>
                  <Select
                    value={editedData.category || ''}
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="בחר" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">פריטים</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNewItem}
                    className="rounded-lg h-7"
                  >
                    <Plus className="w-3 h-3 ml-1" /> פריט
                  </Button>
                </div>
                
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right text-xs">תיאור</TableHead>
                        <TableHead className="text-right w-16 text-xs">כמות</TableHead>
                        <TableHead className="text-right w-20 text-xs">מחיר</TableHead>
                        <TableHead className="text-right w-20 text-xs">סה״כ</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(editedData.line_items || []).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="p-2">
                            <Input
                              value={item.description || ''}
                              onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                              className="rounded-lg h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.quantity || ''}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="rounded-lg h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unit_price || ''}
                              onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                              className="rounded-lg h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell className="p-2 font-bold text-sm">
                            ₪{(item.total || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="p-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={calculateTotals}
                  className="w-full rounded-lg"
                >
                  <Calculator className="w-3 h-3 ml-1" />
                  חשב מחדש
                </Button>
              </div>

              <Separator />

              {/* Totals */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">מע״ם</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.vat_amount || ''}
                    onChange={(e) => handleInputChange('vat_amount', parseFloat(e.target.value) || 0)}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">סה״כ *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editedData.total_amount || ''}
                    onChange={(e) => handleInputChange('total_amount', parseFloat(e.target.value) || 0)}
                    className="rounded-lg font-bold"
                  />
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">סכום כולל:</span>
                  <span className="text-xl font-bold text-blue-700">
                    ₪{(editedData.total_amount || 0).toLocaleString('he-IL', {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t fixed bottom-0 left-0 right-0 bg-white p-4 border-t-slate-200 md:static md:bg-transparent md:p-0 md:border-t-0 z-10">
        <Button
        variant="outline"
        onClick={onReject}
        disabled={isProcessing}
        className="rounded-xl flex-1 md:flex-none"
        >
        <XCircle className="w-4 h-4 ml-1" /> דחה
        </Button>
        <Button
        onClick={() => onApprove(editedData)}
        disabled={isProcessing}
        className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl flex-1 md:flex-none"
        >
        <CheckCircle className="w-4 h-4 ml-1" /> אשר וצור קבלה
        </Button>
        </div>
        </DialogContent>
        </Dialog>
  );
}