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
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{batch.batch_name}</h1>
          {batch.customer_name && (
            <p className="text-slate-500 text-lg">לקוח: {batch.customer_name}</p>
          )}
        </div>
        <Badge className={`${status.color} border-0 flex items-center gap-2 px-4 py-2 text-base`}>
          <StatusIcon className="w-4 h-4" />
          {status.label}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-lg shadow-slate-200/50">
          <p className="text-sm text-slate-500 mb-1">קבלות</p>
          <p className="text-2xl font-bold text-slate-900">
            {batch.processed_receipts || 0} / {batch.total_receipts || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-lg shadow-slate-200/50">
          <p className="text-sm text-slate-500 mb-1">התקדמות</p>
          <p className="text-2xl font-bold text-slate-900">{progress}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-lg shadow-slate-200/50 md:col-span-2">
          <p className="text-sm text-slate-500 mb-1">סה״כ סכום</p>
          <p className="text-2xl font-bold text-blue-700">
            ₪{(batch.total_amount || 0).toLocaleString('he-IL', {minimumFractionDigits: 2})}
          </p>
        </div>
      </div>

      {batch.notes && (
        <div className="mt-4 bg-slate-50 rounded-xl p-4">
          <p className="text-sm text-slate-500 mb-1">הערות</p>
          <p className="text-slate-700">{batch.notes}</p>
        </div>
      )}
    </div>
  );
}