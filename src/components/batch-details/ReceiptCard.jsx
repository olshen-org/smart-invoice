import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronDown, ChevronUp, MoreVertical, Trash2, Plus,
  TrendingUp, TrendingDown, ShoppingBag, Car, Utensils,
  Building, Briefcase, Monitor, Shield, Megaphone, Users, Package
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  calculateItemTotal,
  sumLineItems,
  parseNumber
} from "@/lib/receiptCalculations";

const CATEGORIES = [
  { value: "office_supplies", label: "ציוד משרדי", icon: Package },
  { value: "utilities", label: "שירותים", icon: Building },
  { value: "travel", label: "נסיעות", icon: Car },
  { value: "meals", label: "ארוחות", icon: Utensils },
  { value: "equipment", label: "ציוד", icon: Monitor },
  { value: "services", label: "שירותים מקצועיים", icon: Briefcase },
  { value: "rent", label: "שכירות", icon: Building },
  { value: "insurance", label: "ביטוח", icon: Shield },
  { value: "marketing", label: "שיווק", icon: Megaphone },
  { value: "salary", label: "משכורות", icon: Users },
  { value: "other", label: "אחר", icon: ShoppingBag }
];

const INCOME_CATEGORIES = [
  { value: "sales", label: "מכירות", icon: ShoppingBag },
  { value: "services", label: "שירותים", icon: Briefcase },
  { value: "other_income", label: "הכנסה אחרת", icon: Package }
];

function getCategoryIcon(category, type) {
  const categories = type === 'income' ? INCOME_CATEGORIES : CATEGORIES;
  const found = categories.find(c => c.value === category);
  return found?.icon || ShoppingBag;
}

function getCategoryLabel(category, type) {
  const categories = type === 'income' ? INCOME_CATEGORIES : CATEGORIES;
  const found = categories.find(c => c.value === category);
  return found?.label || category || 'אחר';
}

export default function ReceiptCard({
  receipt,
  onSave,
  onDelete,
  isExpanded,
  onToggleExpand
}) {
  const [editedData, setEditedData] = useState(receipt);
  const [vatPercent, setVatPercent] = useState(() => {
    const vat = Number(receipt?.vat_amount) || 0;
    const total = Number(receipt?.total_amount) || 0;
    if (vat > 0 && total > vat) {
      const subtotal = total - vat;
      return Math.round((vat / subtotal) * 100);
    }
    return 18;
  });

  const isIncome = editedData.type === 'income';
  const CategoryIcon = getCategoryIcon(editedData.category, editedData.type);

  // Auto-calculated values
  const subtotal = useMemo(() => sumLineItems(editedData.line_items), [editedData.line_items]);
  const vatAmount = useMemo(() => Math.round((subtotal * vatPercent / 100) * 100) / 100, [subtotal, vatPercent]);
  const total = useMemo(() => Math.round((subtotal + vatAmount) * 100) / 100, [subtotal, vatAmount]);

  const handleInputChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...(editedData.line_items || [])];
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'description' ? value : parseNumber(value),
    };

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

  const handleSave = () => {
    onSave({
      ...editedData,
      vat_amount: vatAmount,
      total_amount: total
    });
  };

  const handleTypeToggle = () => {
    const newType = editedData.type === 'income' ? 'expense' : 'income';
    setEditedData(prev => ({ ...prev, type: newType, category: '' }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const itemCount = (editedData.line_items || []).length;

  return (
    <div className={cn(
      "bg-white border rounded-xl transition-all duration-200",
      isExpanded ? "border-blue-300 shadow-md" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
    )}>
      {/* Collapsed Header - Always Visible */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Type Indicator */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
          isIncome ? "bg-green-100" : "bg-red-100"
        )}>
          {isIncome ? (
            <TrendingUp className="w-5 h-5 text-green-600" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-600" />
          )}
        </div>

        {/* Main Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 truncate">
              {editedData.vendor_name || 'ללא שם'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CategoryIcon className="w-3 h-3" />
            <span>{getCategoryLabel(editedData.category, editedData.type)}</span>
            {itemCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span>{itemCount} פריטים</span>
              </>
            )}
            {editedData.date && (
              <>
                <span className="text-slate-300">·</span>
                <span>{formatDate(editedData.date)}</span>
              </>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className={cn(
          "text-lg font-bold shrink-0",
          isIncome ? "text-green-700" : "text-slate-900"
        )}>
          ₪{(Number(receipt.total_amount) || 0).toLocaleString('he-IL', { minimumFractionDigits: 0 })}
        </div>

        {/* Menu & Expand */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleTypeToggle}>
                {isIncome ? 'הפוך להוצאה' : 'הפוך להכנסה'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDelete(receipt.id)} className="text-red-600">
                <Trash2 className="w-4 h-4 ml-2" />
                מחק
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="h-8 w-8">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Edit Form */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Basic Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{isIncome ? 'לקוח' : 'ספק'}</Label>
              <Input
                value={editedData.vendor_name || ''}
                onChange={(e) => handleInputChange('vendor_name', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">תאריך</Label>
              <Input
                type="date"
                value={editedData.date || ''}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">מספר קבלה</Label>
              <Input
                value={editedData.receipt_number || ''}
                onChange={(e) => handleInputChange('receipt_number', e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">קטגוריה</Label>
              <Select value={editedData.category || ''} onValueChange={(v) => handleInputChange('category', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="בחר" /></SelectTrigger>
                <SelectContent>
                  {(isIncome ? INCOME_CATEGORIES : CATEGORIES).map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">פריטים</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addNewItem} className="h-7 text-xs">
                <Plus className="w-3 h-3 ml-1" /> הוסף
              </Button>
            </div>

            <div className="space-y-2">
              {(editedData.line_items || []).map((item, index) => (
                <div key={index} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                  <Input
                    value={item.description || ''}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder="תיאור"
                    className="flex-1 h-8 text-sm"
                  />
                  <Input
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    placeholder="כמות"
                    className="w-16 h-8 text-sm text-center"
                  />
                  <span className="text-slate-400 text-sm">×</span>
                  <Input
                    type="number"
                    value={item.unit_price || ''}
                    onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                    placeholder="מחיר"
                    className="w-20 h-8 text-sm"
                  />
                  <span className="text-slate-400 text-sm">=</span>
                  <span className="w-20 text-sm font-semibold text-right">
                    ₪{(item.total || 0).toFixed(2)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="h-7 w-7 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className={cn(
            "rounded-lg p-3 space-y-2",
            isIncome ? "bg-green-50" : "bg-slate-100"
          )}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">סה״כ לפני מע״מ</span>
              <span className="font-medium">₪{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <div className="flex items-center gap-1">
                <span className="text-slate-600">מע״מ</span>
                <Input
                  type="number"
                  value={vatPercent}
                  onChange={(e) => setVatPercent(parseNumber(e.target.value))}
                  className="w-12 h-6 text-xs text-center"
                />
                <span className="text-slate-500 text-xs">%</span>
              </div>
              <span className="font-medium">₪{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200">
              <span className="font-bold">סה״כ</span>
              <span className={cn("text-lg font-bold", isIncome ? "text-green-700" : "text-blue-700")}>
                ₪{total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onToggleExpand}>
              ביטול
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className={isIncome ? "bg-green-600 hover:bg-green-700" : ""}
            >
              שמור שינויים
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
