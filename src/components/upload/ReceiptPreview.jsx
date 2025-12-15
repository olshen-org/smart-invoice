import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, X, Calculator } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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

export default function ReceiptPreview({ extractedData, fileUrl, onSave, onCancel, isProcessing }) {
  const [editedData, setEditedData] = useState(extractedData);

  useEffect(() => {
    // Calculate totals when component mounts or items change
    calculateTotals();
  }, []);

  const handleInputChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...(editedData.line_items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'description' ? value : parseFloat(value) || 0,
    };

    // Calculate item total
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = Number(newItems[index].quantity) || 0;
      const unitPrice = Number(newItems[index].unit_price) || 0;
      newItems[index].total = Math.round(quantity * unitPrice * 100) / 100;
    }

    setEditedData(prev => ({
      ...prev,
      line_items: newItems
    }));
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
    setEditedData(prev => {
      const itemsTotal = (prev.line_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
      const vatAmount = prev.vat_amount || 0;
      const totalWithVat = Math.round((itemsTotal + vatAmount) * 100) / 100; // Round to 2 decimals
      return { ...prev, total_amount: totalWithVat };
    });
  };

  const handleSave = () => {
    calculateTotals();
    onSave(editedData);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Preview Image */}
      <Card className="border-none shadow-2xl shadow-slate-200/50">
        <CardHeader>
          <CardTitle>תמונת הקבלה</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl overflow-hidden border border-slate-200">
            {fileUrl?.toLowerCase().endsWith('.pdf') ? (
              <iframe
                src={fileUrl}
                className="w-full h-[600px]"
                title="Receipt PDF"
              />
            ) : (
              <img
                src={fileUrl}
                alt="Receipt"
                className="w-full h-auto"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editable Form */}
      <Card className="border-none shadow-2xl shadow-slate-200/50">
        <CardHeader>
          <CardTitle>פרטי הקבלה</CardTitle>
          <p className="text-sm text-slate-500">ודא שהפרטים נכונים וערוך במידת הצורך</p>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <Select
                value={editedData.currency || 'ILS'}
                onValueChange={(value) => handleInputChange('currency', value)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ILS">₪ שקל</SelectItem>
                  <SelectItem value="USD">$ דולר</SelectItem>
                  <SelectItem value="EUR">€ יורו</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">קטגוריה</Label>
              <Select
                value={editedData.category || ''}
                onValueChange={(value) => handleInputChange('category', value)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="בחר קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">אמצעי תשלום</Label>
              <Select
                value={editedData.payment_method || ''}
                onValueChange={(value) => handleInputChange('payment_method', value)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="בחר אמצעי תשלום" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
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
              <Button
                variant="outline"
                size="sm"
                onClick={addNewItem}
                className="rounded-xl"
              >
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
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity || ''}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price || ''}
                          onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                          className="rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-bold">
                          ₪{(item.total || 0).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
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

            <Button
              variant="outline"
              onClick={calculateTotals}
              className="w-full rounded-xl"
            >
              <Calculator className="w-4 h-4 ml-2" />
              חשב מחדש
            </Button>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vat_amount">מע״ם</Label>
                <Input
                  id="vat_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editedData.vat_amount || ''}
                  onChange={(e) => handleInputChange('vat_amount', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_amount">סה״כ *</Label>
                <Input
                  id="total_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editedData.total_amount || ''}
                  onChange={(e) => handleInputChange('total_amount', parseFloat(e.target.value) || 0)}
                  className="rounded-xl font-bold text-lg"
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="flex justify-between items-center text-xl">
                <span className="font-bold">סכום כולל לתשלום:</span>
                <span className="text-2xl font-bold text-blue-700">
                  ₪{(editedData.total_amount || 0).toLocaleString('he-IL', {minimumFractionDigits: 2})}
                </span>
              </div>
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
        
        <CardFooter className="flex justify-end gap-3 pt-6 border-t">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="rounded-xl"
          >
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
    </div>
  );
}