import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, CheckCircle, XCircle, Loader2, ArrowUpCircle, ArrowDownCircle, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calculateItemTotal,
  sumLineItems,
  parseNumber
} from "@/lib/receiptCalculations";
import { useReceiptUpload } from "@/lib/useReceiptUpload";
import { toast } from "sonner";

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
  { value: "salary", label: "משכורות" },
  { value: "other", label: "אחר" }
];

const INCOME_CATEGORIES = [
  { value: "sales", label: "מכירות" },
  { value: "services", label: "שירותים" },
  { value: "other_income", label: "הכנסה אחרת" }
];

// Extract Google Drive file ID from URL
function extractFileId(url) {
  if (!url) return null;
  const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

export default function ReceiptReviewModal({ receipt, onApprove, onReject, onClose, onSave, onDelete, isProcessing }) {
  // Determine if this is an existing receipt (has id) or a new upload
  const isExistingReceipt = !!receipt?.id;
  const [editedData, setEditedData] = useState(receipt);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const { reprocessFromUrl, isProcessing: isReprocessing } = useReceiptUpload();

  // VAT percentage state - derive initial from receipt data or default to 18
  const [vatPercent, setVatPercent] = useState(() => {
    const vat = Number(receipt?.vat_amount) || 0;
    const total = Number(receipt?.total_amount) || 0;
    if (vat > 0 && total > vat) {
      const subtotal = total - vat;
      return Math.round((vat / subtotal) * 100);
    }
    return 18;
  });
  const [isEditingVat, setIsEditingVat] = useState(false);

  useEffect(() => {
    setEditedData({ ...receipt, type: receipt.type || 'expense' });
    // Reset VAT percent when receipt changes
    const vat = Number(receipt?.vat_amount) || 0;
    const total = Number(receipt?.total_amount) || 0;
    if (vat > 0 && total > vat) {
      const subtotal = total - vat;
      setVatPercent(Math.round((vat / subtotal) * 100));
    } else {
      setVatPercent(18);
    }
    setImageLoaded(false);
    setRetryCount(0);
  }, [receipt]);

  // Auto-calculated values
  const subtotal = useMemo(() => sumLineItems(editedData.line_items), [editedData.line_items]);
  const vatAmount = useMemo(() => Math.round((subtotal * vatPercent / 100) * 100) / 100, [subtotal, vatPercent]);
  const total = useMemo(() => Math.round((subtotal + vatAmount) * 100) / 100, [subtotal, vatAmount]);

  // Update editedData whenever calculated values change
  useEffect(() => {
    setEditedData(prev => ({
      ...prev,
      vat_amount: vatAmount,
      total_amount: total
    }));
  }, [vatAmount, total]);

  const receiptUrl = editedData.receipt_image_url;
  const fileId = extractFileId(receiptUrl);
  const isReceiptPDF = receiptUrl?.toLowerCase().includes('.pdf');

  // Google Drive URLs - use thumbnail for better iOS compatibility
  const imageUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : receiptUrl;
  const pdfUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : receiptUrl;

  const handleImageError = () => {
    if (retryCount < 10) {
      setTimeout(() => setRetryCount(c => c + 1), 2000);
    }
  };

  const handleInputChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleTypeChange = (type) => {
    setEditedData(prev => ({ ...prev, type }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...(editedData.line_items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'description' ? value : parseNumber(value),
    };

    // Auto-update item total when quantity or price changes
    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total = calculateItemTotal(
        newItems[index].quantity,
        newItems[index].unit_price
      );
    }

    setEditedData(prev => ({ ...prev, line_items: newItems }));
  };

  const addNewItem = () => {
    setEditedData(prev => ({
      ...prev,
      line_items: [...(prev.line_items || []), { description: '', quantity: 1, unit_price: 0, total: 0 }]
    }));
  };

  const removeItem = (index) => {
    setEditedData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const handleReprocess = async () => {
    if (!editedData.receipt_image_url) {
      toast.error("אין כתובת תמונה לעיבוד מחדש");
      return;
    }

    try {
      toast.info("מעבד מחדש...", { duration: 3000 });
      const result = await reprocessFromUrl(editedData.receipt_image_url);

      // Reset form with new data, preserve id and batch_id
      setEditedData(prev => ({
        ...result,
        id: prev.id,
        batch_id: prev.batch_id,
        type: prev.type || 'expense',
        receipt_image_url: prev.receipt_image_url
      }));

      // Reset VAT percent from new data
      const vat = Number(result.vat_amount) || 0;
      const total = Number(result.total_amount) || 0;
      if (vat > 0 && total > vat) {
        const subtotal = total - vat;
        setVatPercent(Math.round((vat / subtotal) * 100));
      } else {
        setVatPercent(18);
      }

      toast.success("הנתונים עודכנו בהצלחה");
    } catch (error) {
      toast.error("שגיאה בעיבוד מחדש");
    }
  };

  const isIncome = editedData.type === 'income';

  return (
    <Dialog open={!!receipt} onOpenChange={onClose}>
      <DialogContent className="w-full h-full md:max-w-6xl md:h-[95vh] max-w-none m-0 rounded-none md:rounded-xl p-4 md:p-6 overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl font-bold flex items-center gap-3">
            <span>{isExistingReceipt ? 'פרטי עסקה' : 'אישור עסקה'}</span>
            <Tabs value={editedData.type} onValueChange={handleTypeChange} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="expense" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900">
                  <ArrowDownCircle className="w-4 h-4 ml-1" /> הוצאה
                </TabsTrigger>
                <TabsTrigger value="income" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-900">
                  <ArrowUpCircle className="w-4 h-4 ml-1" /> הכנסה
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full pb-20 md:pb-0">
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 p-1">
              {/* Image/PDF Preview */}
              <div className="space-y-4 order-2 lg:order-1">
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 min-h-[300px] lg:min-h-[500px] flex items-center justify-center relative">
                  {isReceiptPDF ? (
                    <iframe src={pdfUrl} className="w-full h-[600px] rounded-xl" title="PDF Viewer" />
                  ) : (
                    <>
                      {!imageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                      )}
                      <img
                        key={retryCount}
                        src={imageUrl}
                        alt="Receipt"
                        className={`w-full h-auto max-h-[600px] object-contain ${imageLoaded ? '' : 'opacity-0'}`}
                        onLoad={() => setImageLoaded(true)}
                        onError={handleImageError}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Editable Form */}
              <div className="space-y-4 order-1 lg:order-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">שם {isIncome ? 'הלקוח' : 'הספק'} *</Label>
                    <Input
                      value={editedData.vendor_name || ''}
                      onChange={(e) => handleInputChange('vendor_name', e.target.value)}
                      className="rounded-lg"
                      title={editedData.vendor_name || ''}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">מספר {isIncome ? 'חשבונית' : 'קבלה'}</Label>
                    <Input
                      value={editedData.receipt_number || ''}
                      onChange={(e) => handleInputChange('receipt_number', e.target.value)}
                      className="rounded-lg"
                      title={editedData.receipt_number || ''}
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
                    <Select value={editedData.category || ''} onValueChange={(value) => handleInputChange('category', value)}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="בחר" /></SelectTrigger>
                      <SelectContent>
                        {(isIncome ? INCOME_CATEGORIES : CATEGORIES).map((cat) => (
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
                    <Button type="button" variant="outline" size="sm" onClick={addNewItem} className="rounded-lg h-7">
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
                                title={item.description || ''}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.quantity || ''}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                className="rounded-lg h-8 text-sm"
                                title={String(item.quantity || '')}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unit_price || ''}
                                onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                                className="rounded-lg h-8 text-sm"
                                title={String(item.unit_price || '')}
                              />
                            </TableCell>
                            <TableCell className="p-2">
                              <div
                                className="font-bold text-sm bg-slate-50 rounded-lg px-3 py-2 text-right"
                                title={`₪${(item.total || 0).toFixed(2)}`}
                              >
                                ₪{(item.total || 0).toFixed(2)}
                              </div>
                            </TableCell>
                            <TableCell className="p-2">
                              <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-7 w-7 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <Separator />

                {/* Invoice Summary - Standard Israeli Format */}
                <div className={`rounded-xl p-4 space-y-3 ${isIncome ? 'bg-green-50' : 'bg-slate-50'}`}>
                  <h3 className="text-sm font-bold text-slate-700">סיכום חשבונית</h3>

                  {/* Subtotal - auto-calculated */}
                  <div className="flex justify-between items-center py-2 border-b border-slate-200">
                    <span className="text-sm text-slate-600">סה״כ לפני מע״מ</span>
                    <span className="font-semibold text-slate-800">
                      ₪{subtotal.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                    </span>
                  </div>

                  {/* VAT - percentage editable on double-click */}
                  <div className="flex justify-between items-center py-2 border-b border-slate-200">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-slate-600">מע״מ</span>
                      {isEditingVat ? (
                        <div className="flex items-center">
                          <span className="text-slate-400 text-sm">(</span>
                          <Input
                            type="number"
                            step="1"
                            value={vatPercent}
                            onChange={(e) => setVatPercent(parseNumber(e.target.value))}
                            onBlur={() => setIsEditingVat(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setIsEditingVat(false)}
                            className="w-12 text-center rounded h-6 text-xs mx-1"
                            autoFocus
                          />
                          <span className="text-slate-400 text-sm">%)</span>
                        </div>
                      ) : (
                        <span
                          className="text-sm text-slate-500 cursor-pointer hover:text-blue-600 hover:underline"
                          onDoubleClick={() => setIsEditingVat(true)}
                          title="לחץ פעמיים לעריכה"
                        >
                          ({vatPercent}%)
                        </span>
                      )}
                    </div>
                    <span className="font-semibold text-slate-800">
                      ₪{vatAmount.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                    </span>
                  </div>

                  {/* Total - auto-calculated */}
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-slate-800">סה״כ לתשלום</span>
                    <span className={`text-xl font-bold ${isIncome ? 'text-green-700' : 'text-blue-700'}`}>
                      ₪{total.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-between gap-3 pt-4 border-t bg-white border-t-slate-200 z-10">
          {/* Left side actions */}
          <div className="flex gap-2">
            {/* Reprocess button */}
            <Button
              variant="ghost"
              onClick={handleReprocess}
              disabled={isProcessing || isReprocessing}
              className="rounded-xl text-slate-600 hover:text-slate-900"
            >
              {isReprocessing ? (
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 ml-1" />
              )}
              עיבוד מחדש
            </Button>

            {/* Delete button - only for existing receipts */}
            {isExistingReceipt && onDelete && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("האם למחוק את הקבלה?")) {
                    onDelete(receipt.id);
                    onClose();
                  }
                }}
                disabled={isProcessing || isReprocessing}
                className="rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 ml-1" />
                מחק
              </Button>
            )}
          </div>

          {/* Action buttons - right side (left in RTL) */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isProcessing || isReprocessing} className="rounded-xl flex-1 md:flex-none">
              <XCircle className="w-4 h-4 ml-1" /> {isExistingReceipt ? 'ביטול' : 'דחה'}
            </Button>

            {isExistingReceipt ? (
              <Button
                onClick={() => onSave?.(editedData)}
                disabled={isProcessing || isReprocessing}
                className={`rounded-xl flex-1 md:flex-none text-white ${isIncome ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <CheckCircle className="w-4 h-4 ml-1" /> שמור שינויים
              </Button>
            ) : (
              <Button
                onClick={() => onApprove(editedData)}
                disabled={isProcessing || isReprocessing}
                className={`rounded-xl flex-1 md:flex-none text-white ${isIncome ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <CheckCircle className="w-4 h-4 ml-1" /> אשר וצור {isIncome ? 'הכנסה' : 'הוצאה'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
