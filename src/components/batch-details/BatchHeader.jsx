import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Layers } from "lucide-react";

const statusConfig = {
  open: { label: "פתוח", color: "bg-blue-100 text-blue-800", icon: Clock },
  processing: { label: "בעיבוד", color: "bg-yellow-100 text-yellow-800", icon: Layers },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800", icon: CheckCircle }
};

export default function BatchHeader({ batch }) {
  if (!batch) return null;
  
  const status = statusConfig[batch.status] || statusConfig.open;
  const StatusIcon = status.icon;
  const progress = batch.total_receipts > 0 
    ? Math.round((batch.processed_receipts / batch.total_receipts) * 100) 
    : 0;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{batch.batch_name}</h1>
          {batch.customer_name && (
            <span className="text-slate-500">לקוח: {batch.customer_name}</span>
          )}
        </div>
        <Badge className={`${status.color} border-0 flex items-center gap-1.5 px-3 py-1`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 mb-1">קבלות</p>
          <p className="text-xl font-bold text-slate-900">
            {batch.processed_receipts || 0} / {batch.total_receipts || 0}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">התקדמות</p>
          <p className="text-xl font-bold text-slate-900">{progress}%</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">סה״כ סכום</p>
          <p className="text-xl font-bold text-blue-700">
            ₪{(batch.total_amount || 0).toLocaleString('he-IL', {minimumFractionDigits: 2})}
          </p>
        </div>
      </div>

      {batch.notes && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 mb-1">הערות</p>
          <p className="text-sm text-slate-700">{batch.notes}</p>
        </div>
      )}
    </div>
  );
}