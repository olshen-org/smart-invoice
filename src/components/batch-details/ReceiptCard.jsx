import { Button } from "@/components/ui/button";
import {
  MoreVertical, Trash2, Eye,
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
  onDelete,
  onToggleExpand
}) {
  const isIncome = receipt.type === 'income';
  const CategoryIcon = getCategoryIcon(receipt.category, receipt.type);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const itemCount = (receipt.line_items || []).length;

  return (
    <div className={cn(
      "bg-white border rounded-xl transition-all duration-200",
      "border-slate-200 hover:border-slate-300 hover:shadow-sm cursor-pointer"
    )}>
      {/* Card Content - Click to open modal */}
      <div
        className="flex items-center gap-3 p-3"
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
              {receipt.vendor_name || 'ללא שם'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CategoryIcon className="w-3 h-3" />
            <span>{getCategoryLabel(receipt.category, receipt.type)}</span>
            {itemCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span>{itemCount} פריטים</span>
              </>
            )}
            {receipt.date && (
              <>
                <span className="text-slate-300">·</span>
                <span>{formatDate(receipt.date)}</span>
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

        {/* Menu */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onToggleExpand}>
                <Eye className="w-4 h-4 ml-2" />
                צפה ועריכה
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDelete(receipt.id)} className="text-red-600">
                <Trash2 className="w-4 h-4 ml-2" />
                מחק
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
