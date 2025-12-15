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
import { Plus, Trash2, CheckCircle, XCircle, Calculator, ExternalLink, Loader2, FileText, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { api } from "@/lib/apiClient";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

export default function ReceiptReviewModal({ receipt, onApprove, onReject, onClose, isProcessing }) {
  const [editedData, setEditedData] = useState(receipt);
  const [vatPercent, setVatPercent] = useState(17);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

  useEffect(() => {
    setEditedData({
        ...receipt,
        type: receipt.type || 'expense' // Ensure type exists
    });
    // Calculate VAT percent if we have both total and VAT amount
    if (receipt.total_amount && receipt.vat_amount) {
      const itemsTotal = receipt.total_amount - receipt.vat_amount;
      if (itemsTotal > 0) {
        const percent = Math.round((receipt.vat_amount / itemsTotal) * 100);
        setVatPercent(percent);
      }
    }
  }, [receipt]);

  // Helper to check for PDF
  const isPDF = (url) => url?.toLowerCase().endsWith('.pdf');
  const isReceiptPDF = isPDF(editedData.receipt_image_url);

  useEffect(() => {
    if (isReceiptPDF && editedData.receipt_image_url) {
      setPdfBlobUrl(editedData.receipt_image_url);
    } else {
       setPdfBlobUrl(null);
    }
  }, [editedData.receipt_image_url, isReceiptPDF]);

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
      [field]: field === 'description' ? value : parseFloat(value) || 0,
    };

    if (field === 'quantity' || field === 'unit_price') {
      const quantity = Number(newItems[index].quantity) || 0;
      const unitPrice = Number(newItems[index].unit_price) || 0;
      newItems[index].total = Math.round(quantity * unitPrice * 100) / 100;
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
    setEditedData(prev => {
      const itemsTotal = (prev.line_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
      const vatAmount = Math.round((itemsTotal * (vatPercent / 100)) * 100) / 100;
      const totalWithVat = Math.round((itemsTotal + vatAmount) * 100) / 100;
      return { 
        ...prev, 
        vat_amount: vatAmount,
        total_amount: totalWithVat 
      };
    });
  };

  const handleVatPercentChange = (value) => {
    const percent = parseFloat(value) || 0;
    setVatPercent(percent);
    setEditedData(prev => {
      const itemsTotal = (prev.line_items || []).reduce((sum, item) => sum + (item.total || 0), 0);
      const vatAmount = Math.round((itemsTotal * (percent / 100)) * 100) / 100;
      const totalWithVat = Math.round((itemsTotal + vatAmount) * 100) / 100;
      return { 
        ...prev, 
        vat_amount: vatAmount,
        total_amount: totalWithVat 
      };
    });
  };

  const isIncome = editedData.type === 'income';

  return (
    <Dialog open={!!receipt} onOpenChange={onClose}>
      <DialogContent className="w-full h-full md:max-w-6xl md:h-[95vh] max-w-none m-0 rounded-none md:rounded-xl p-4 md:p-6 overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl font-bold flex items-center gap-3">
            <span>אישור עסקה</span>
            <Tabs value={editedData.type} onValueChange={handleTypeChange} className="w-[200px]">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="expense" className="data-[state=active]:bg-red-100 data-[state=active]:text-red-900">
                        <ArrowDownCircle className="w-4 h-4 ml-1" />
                        הוצאה
                    </TabsTrigger>
                    <TabsTrigger value="income" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-900">
                        <ArrowUpCircle className="w-4 h-4 ml-1" />
                        הכנסה
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
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 min-h-[300px] lg:min-h-[500px] flex items-center justify-center">
                {isReceiptPDF ? (
                    <div className="w-full h-[600px] relative group">
                        {/* Desktop - Google Docs Viewer */}
                        <iframe
                            src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfBlobUrl)}&embedded=true`}
                            className="w-full h-full hidden md:block rounded-xl bg-slate-100"
                            title="PDF Viewer"
                        />

                        {/* Mobile - Direct Link */}
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

                        {/* Desktop Overlay */}
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
                    <img 
                    src={editedData.receipt_image_url} 
                    alt="Receipt" 
                    className="w-full h-auto max-h-[600px] object-contain"
                    />
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
                    />
                    </div>
                    <div className="space-y-1">
                    <Label className="text-xs">מספר {isIncome ? 'חשבונית' : 'קבלה'}</Label>
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
                                className="rounded-lg h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </TableCell>
                            <TableCell className="p-2">
                                <Input
                                type="number"
                                step="0.01"
                                value={item.unit_price || ''}
                                onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                                className="rounded-lg h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                            </TableCell>
                            <TableCell className="p-2">
                                <div className="font-bold text-sm bg-slate-50 rounded-lg px-3 py-2 text-right">
                                ₪{(item.total || 0).toFixed(2)}
                                </div>
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
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold">סיכום</Label>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={calculateTotals}
                        className="rounded-lg h-7"
                    >
                        <Calculator className="w-3 h-3 ml-1" />
                        חשב מחדש
                    </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label className="text-xs">מע״ם (%)</Label>
                        <Input
                        type="number"
                        step="1"
                        value={vatPercent}
                        onChange={(e) => handleVatPercentChange(e.target.value)}
                        className="rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">סכום מע״ם</Label>
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium">
                        ₪{(editedData.vat_amount || 0).toFixed(2)}
                        </div>
                    </div>
                    </div>
                </div>

                <div className={`rounded-xl p-4 ${isIncome ? 'bg-gradient-to-br from-green-50 to-green-100' : 'bg-gradient-to-br from-red-50 to-red-100'}`}>
                    <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">סכום כולל:</span>
                    <span className={`text-xl font-bold ${isIncome ? 'text-green-700' : 'text-red-700'}`}>
                        ₪{(editedData.total_amount || 0).toLocaleString('he-IL', {minimumFractionDigits: 2})}
                    </span>
                    </div>
                </div>
                </div>
            </div>
            </ScrollArea>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t bg-white border-t-slate-200 z-10">
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
        className={`rounded-xl flex-1 md:flex-none text-white ${isIncome ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
        <CheckCircle className="w-4 h-4 ml-1" /> אשר וצור {isIncome ? 'הכנסה' : 'הוצאה'}
        </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}