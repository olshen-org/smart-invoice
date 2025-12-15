import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Layers, ArrowUpCircle, ArrowDownCircle, Wallet, Calendar, Hourglass } from "lucide-react";

const lifecycleConfig = {
  draft: { label: "שלב 1 · יצירת תקופה", color: "bg-slate-100 text-slate-700", icon: Clock },
  collecting: { label: "שלב 2 · העלאה ראשונה", color: "bg-blue-100 text-blue-800", icon: Layers },
  waiting: { label: "שלב 3 · המתנה להמשך", color: "bg-yellow-100 text-yellow-800", icon: Hourglass },
  ready_to_close: { label: "שלב 4 · מוכן לסגירה", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800", icon: CheckCircle }
};

export default function BatchHeader({ batch, incomeTotal = 0, expenseTotal = 0 }) {
  if (!batch) return null;
  
  const statusKey = batch.lifecycle_stage || batch.status || 'draft';
  const status = lifecycleConfig[statusKey] || lifecycleConfig.draft;
  const StatusIcon = status.icon;
  const progress = batch.total_receipts > 0 
    ? Math.round((batch.processed_receipts / batch.total_receipts) * 100) 
    : 0;

  const netTotal = incomeTotal - expenseTotal;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{batch.batch_name}</h1>
            <Badge className={`${status.color} border-0 flex items-center gap-1 px-2 py-0.5 text-xs`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </Badge>
            {batch.period_label && (
              <Badge variant="outline" className="text-xs flex items-center gap-1 border-slate-200 text-slate-600">
                <Calendar className="w-3 h-3" />
                {batch.period_label}
              </Badge>
            )}
          </div>
          {batch.customer_name && (
            <span className="text-sm text-slate-500">לקוח: {batch.customer_name}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-green-50 rounded-lg p-3 border border-green-100">
          <div className="flex items-center gap-1.5 text-green-700 mb-1">
            <ArrowUpCircle className="w-4 h-4" />
            <span className="text-xs font-medium">הכנסות</span>
          </div>
          <p className="text-lg md:text-xl font-bold text-green-700">
            ₪{incomeTotal.toLocaleString('he-IL', {minimumFractionDigits: 2})}
          </p>
        </div>

        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
          <div className="flex items-center gap-1.5 text-red-700 mb-1">
            <ArrowDownCircle className="w-4 h-4" />
            <span className="text-xs font-medium">הוצאות</span>
          </div>
          <p className="text-lg md:text-xl font-bold text-red-700">
            ₪{expenseTotal.toLocaleString('he-IL', {minimumFractionDigits: 2})}
          </p>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 col-span-2 md:col-span-1">
          <div className="flex items-center gap-1.5 text-slate-700 mb-1">
            <Wallet className="w-4 h-4" />
            <span className="text-xs font-medium">נטו</span>
          </div>
          <p className={`text-lg md:text-xl font-bold ${netTotal >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
            ₪{netTotal.toLocaleString('he-IL', {minimumFractionDigits: 2})}
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 hidden md:block">
           <div className="flex items-center gap-1.5 text-blue-700 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">סטטוס</span>
          </div>
          <p className="text-lg md:text-xl font-bold text-blue-700">
            {batch.processed_receipts || 0} / {batch.total_receipts || 0}
          </p>
        </div>
      </div>

      {batch.notes && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-1">הערות</p>
          <p className="text-sm text-slate-700">{batch.notes}</p>
        </div>
      )}
    </div>
  );
}