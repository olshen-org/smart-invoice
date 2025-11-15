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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, CheckCircle, XCircle, Calculator } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { base44 } from "@/api/base44Client";

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
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    setEditedData(receipt);
    
    const isPDF = receipt?.receipt_image_url?.toLowerCase().endsWith('.pdf');
    if (isPDF && receipt.receipt_image_url) {
      const proxyUrl = base44.functions.getFunctionUrl('viewPdf') + '?url=' + encodeURIComponent(receipt.receipt_image_url);
      setPdfUrl(proxyUrl);
    } else {
      setPdfUrl(null);
    }
  }, [receipt]);

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

  const isPDF = (url) => url?.toLowerCase().endsWith('.pdf');
  const isReceiptPDF = isPDF(editedData.receipt_image_url);

  return (
    <Dialog open={!!receipt} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">אישור קבלה</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(95vh-120px)]">
          <div className="grid lg:grid-cols-2 gap-6 p-1">
            {/* Image/PDF Preview */}
            <div className="space-y-4">
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                {isReceiptPDF ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full aspect-[3/4]"
                    title="Receipt PDF"
                  />
                ) : (
                  <img 
                    src={editedData.receipt_image_url} 
                    alt="Receipt" 
                    className="w-full h-auto"
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

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onReject}
            disabled={isProcessing}
            className="rounded-xl"
          >
            <XCircle className="w-4 h-4 ml-1" /> דחה
          </Button>
          <Button
            onClick={() => onApprove(editedData)}
            disabled={isProcessing}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl"
          >
            <CheckCircle className="w-4 h-4 ml-1" /> אשר וצור קבלה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}