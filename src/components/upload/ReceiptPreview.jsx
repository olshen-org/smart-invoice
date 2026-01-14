import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, X, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  calculateItemTotal,
  sumLineItems,
  parseNumber
} from "@/lib/receiptCalculations";

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

// Extract Google Drive file ID from URL
function extractFileId(url) {
  if (!url) return null;
  const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

export default function ReceiptPreview({ extractedData, onSave, onCancel, isProcessing }) {
  const [editedData, setEditedData] = useState(extractedData);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // VAT percentage state - derive initial from extracted data or default to 18
  const [vatPercent, setVatPercent] = useState(() => {
    const vat = Number(extractedData?.vat_amount) || 0;
    const total = Number(extractedData?.total_amount) || 0;
    if (vat > 0 && total > vat) {
      const subtotal = total - vat;
      return Math.round((vat / subtotal) * 100);
    }
    return 18;
  });
  const [isEditingVat, setIsEditingVat] = useState(false);

  const receiptUrl = extractedData?.receipt_image_url;
  const fileId = extractFileId(receiptUrl);
  const isPDF = receiptUrl?.toLowerCase().includes('.pdf');

  // Google Drive URLs - use thumbnail for better iOS compatibility
  const imageUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : receiptUrl;
  const pdfUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : receiptUrl;

  // Trust OCR-extracted data - don't auto-recalculate on mount

  // Retry loading image if it fails
  const handleImageError = () => {
    if (retryCount < 10) {
      setTimeout(() => setRetryCount(c => c + 1), 2000);
    }
  };

  const handleInputChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
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

  const handleSave = () => {
    onSave(editedData);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4 md:gap-6 pb-24 lg:pb-0">
      {/* Preview Image - shows second on mobile, first on desktop */}
      <Card className="border-none shadow-2xl shadow-slate-200/50 order-2 lg:order-1">
        <CardHeader className="pb-2 md:pb-6">
          <CardTitle className="text-lg md:text-xl">תמונת הקבלה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl overflow-hidden border border-slate-200 min-h-[200px] md:min-h-[300px] flex items-center justify-center bg-slate-50 relative">
            {isPDF ? (
              <iframe src={pdfUrl} className="w-full h-[400px] md:h-[600px] rounded-xl" title="PDF Preview" />
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
                  className={`w-full h-auto max-h-[400px] md:max-h-[600px] object-contain ${imageLoaded ? '' : 'opacity-0'}`}
                  onLoad={() => setImageLoaded(true)}
                  onError={handleImageError}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editable Form - shows first on mobile */}
      <Card className="border-none shadow-2xl shadow-slate-200/50 order-1 lg:order-2">
        <CardHeader className="pb-2 md:pb-6">
          <CardTitle className="text-lg md:text-xl">פרטי הקבלה</CardTitle>
          <p className="text-sm text-slate-500">ודא שהפרטים נכונים וערוך במידת הצורך</p>
        </CardHeader>
        <CardContent className="space-y-4 md:space-y-6">
          {/* Basic Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_name">שם הספק *</Label>
              <Input
                id="vendor_name"
                value={editedData.vendor_name || ''}
                onChange={(e) => handleInputChange('vendor_name', e.target.value)}
                placeholder="שם העסק"
                className="rounded-xl"
                title={editedData.vendor_name || ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt_number">מספר קבלה</Label>
              <Input
                id="receipt_number"
                value={editedData.receipt_number || ''}
                onChange={(e) => handleInputChange('receipt_number', e.target.value)}
                placeholder="מס׳ קבלה"
                className="rounded-xl"
                title={editedData.receipt_number || ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">תאריך *</Label>
              <Input
                id="date"
                type="date"
                value={editedData.date || ''}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">מטבע</Label>
              <Select value={editedData.currency || 'ILS'} onValueChange={(value) => handleInputChange('currency', value)}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">₪ שקל</SelectItem>
                  <SelectItem value="USD">$ דולר</SelectItem>
                  <SelectItem value="EUR">€ יורו</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">קטגוריה</Label>
              <Select value={editedData.category || ''} onValueChange={(value) => handleInputChange('category', value)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="בחר קטגוריה" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">אמצעי תשלום</Label>
              <Select value={editedData.payment_method || ''} onValueChange={(value) => handleInputChange('payment_method', value)}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="בחר אמצעי תשלום" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">פירוט פריטים</h3>
              <Button variant="outline" size="sm" onClick={addNewItem} className="rounded-xl">
                <Plus className="w-4 h-4 ml-1" /> פריט חדש
              </Button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">תיאור</TableHead>
                    <TableHead className="text-right w-20">כמות</TableHead>
                    <TableHead className="text-right w-24">מחיר</TableHead>
                    <TableHead className="text-right w-24">סה״כ</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(editedData.line_items || []).map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          value={item.description || ''}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          placeholder="תיאור הפריט"
                          className="rounded-lg"
                          title={item.description || ''}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity || ''}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="rounded-lg"
                          title={String(item.quantity || '')}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className="rounded-lg"
                          title={String(item.unit_price || '')}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-bold" title={`₪${(item.total || 0).toFixed(2)}`}>
                          ₪{(item.total || 0).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!editedData.line_items || editedData.line_items.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 py-6">
                        לא נוספו פריטים. לחץ על "פריט חדש" להוספה.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

          </div>

          <Separator />

          {/* Invoice Summary - Standard Israeli Format */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <h3 className="text-lg font-bold text-slate-700">סיכום חשבונית</h3>

            {/* Subtotal - auto-calculated */}
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="text-slate-600">סה״כ לפני מע״מ</span>
              <span className="font-semibold text-slate-800">
                ₪{subtotal.toLocaleString('he-IL', {minimumFractionDigits: 2})}
              </span>
            </div>

            {/* VAT - percentage editable on double-click */}
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <div className="flex items-center gap-1">
                <span className="text-slate-600">מע״מ</span>
                {isEditingVat ? (
                  <div className="flex items-center">
                    <span className="text-slate-400">(</span>
                    <Input
                      type="number"
                      step="1"
                      value={vatPercent}
                      onChange={(e) => setVatPercent(parseNumber(e.target.value))}
                      onBlur={() => setIsEditingVat(false)}
                      onKeyDown={(e) => e.key === 'Enter' && setIsEditingVat(false)}
                      className="w-14 text-center rounded h-7 text-sm mx-1"
                      autoFocus
                    />
                    <span className="text-slate-400">%)</span>
                  </div>
                ) : (
                  <span
                    className="text-slate-500 cursor-pointer hover:text-blue-600 hover:underline"
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
              <span className="text-lg font-bold text-slate-800">סה״כ לתשלום</span>
              <span className="text-2xl font-bold text-blue-700">
                ₪{total.toLocaleString('he-IL', {minimumFractionDigits: 2})}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              value={editedData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="הערות נוספות..."
              className="rounded-xl"
              rows={3}
            />
          </div>
        </CardContent>

        {/* Desktop footer */}
        <CardFooter className="hidden lg:flex justify-end gap-3 pt-6 border-t">
          <Button variant="outline" onClick={onCancel} disabled={isProcessing} className="rounded-xl">
            <X className="w-4 h-4 ml-1" /> ביטול
          </Button>
          <Button
            onClick={handleSave}
            disabled={isProcessing}
            className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl shadow-lg shadow-green-200"
          >
            <Save className="w-4 h-4 ml-1" /> שמור קבלה
          </Button>
        </CardFooter>
      </Card>

      {/* Mobile sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex gap-3 lg:hidden z-50 shadow-lg">
        <Button variant="outline" onClick={onCancel} disabled={isProcessing} className="rounded-xl flex-1">
          <X className="w-4 h-4 ml-1" /> ביטול
        </Button>
        <Button
          onClick={handleSave}
          disabled={isProcessing}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-xl shadow-lg shadow-green-200 flex-1"
        >
          <Save className="w-4 h-4 ml-1" /> שמור קבלה
        </Button>
      </div>
    </div>
  );
}
