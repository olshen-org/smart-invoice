import { TrendingUp, TrendingDown, Receipt, Wallet } from "lucide-react";

export default function StickyTotalsBar({ receipts = [] }) {
  const incomeReceipts = receipts.filter(r => r.type === 'income');
  const expenseReceipts = receipts.filter(r => r.type !== 'income');

  const totalIncome = incomeReceipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);
  const totalExpense = expenseReceipts.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0);

  const vatCollected = incomeReceipts.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0);
  const vatPaid = expenseReceipts.reduce((sum, r) => sum + (Number(r.vat_amount) || 0), 0);
  const netVat = vatCollected - vatPaid;

  const profit = totalIncome - totalExpense;

  const formatCurrency = (amount) => {
    const formatted = Math.abs(amount).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return amount < 0 ? `-${formatted}` : formatted;
  };

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-4">
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        {/* Income */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">הכנסות</span>
          </div>
          <div className="text-sm md:text-lg font-bold text-green-700">
            {formatCurrency(totalIncome)}
          </div>
        </div>

        {/* Expenses */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">הוצאות</span>
          </div>
          <div className="text-sm md:text-lg font-bold text-red-700">
            {formatCurrency(totalExpense)}
          </div>
        </div>

        {/* VAT Net */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
            <Receipt className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">מע״מ</span>
          </div>
          <div className={`text-sm md:text-lg font-bold ${netVat >= 0 ? 'text-purple-700' : 'text-green-700'}`}>
            {formatCurrency(netVat)}
          </div>
        </div>

        {/* Profit */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
            <Wallet className="w-4 h-4" />
            <span className="text-xs font-medium hidden sm:inline">רווח</span>
          </div>
          <div className={`text-sm md:text-lg font-bold ${profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
            {formatCurrency(profit)}
          </div>
        </div>
      </div>
    </div>
  );
}
