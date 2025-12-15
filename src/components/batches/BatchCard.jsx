import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Clock, Layers, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const statusConfig = {
  open: { label: "פתוח", color: "bg-blue-100 text-blue-800", icon: Clock },
  processing: { label: "בעיבוד", color: "bg-yellow-100 text-yellow-800", icon: Layers },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800", icon: CheckCircle }
};

const lifecycleConfig = {
  draft: { label: "נוצר", color: "bg-slate-100 text-slate-700", icon: Clock },
  collecting: { label: "איסוף מסמכים", color: "bg-blue-100 text-blue-800", icon: Layers },
  waiting: { label: "ממתין להמשך", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  ready_to_close: { label: "מוכן לסגירה", color: "bg-green-100 text-green-800", icon: CheckCircle },
  completed: { label: "הושלם", color: "bg-green-100 text-green-800", icon: CheckCircle }
};

export default function BatchCard({ batch, onDelete }) {
  const navigate = useNavigate();
  const status = lifecycleConfig[batch.lifecycle_stage] || statusConfig[batch.status] || lifecycleConfig.draft;
  const StatusIcon = status.icon;

  return (
    <Card 
      className="border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer"
      onClick={() => navigate(createPageUrl("BatchDetails") + `?id=${batch.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-xl mb-2">{batch.batch_name}</CardTitle>
            {batch.customer_name && (
              <p className="text-sm text-slate-500">{batch.customer_name}</p>
            )}
          </div>
          <Badge className={`${status.color} border-0 flex items-center gap-1`}>
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">קבלות:</span>
            <span className="font-bold text-slate-900">
              {batch.processed_receipts || 0} / {batch.total_receipts || 0}
            </span>
          </div>
          
          {batch.total_amount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">סה״כ:</span>
              <span className="font-bold text-slate-900">
                ₪{batch.total_amount.toLocaleString('he-IL', {minimumFractionDigits: 2})}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t">
            <span>נוצר: {format(new Date(batch.created_date), "d MMM yyyy", { locale: he })}</span>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                className="hover:bg-red-50 hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(batch.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="hover:bg-blue-50 hover:text-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(createPageUrl("BatchDetails") + `?id=${batch.id}`);
                }}
              >
                פתח
                <ArrowLeft className="w-4 h-4 mr-1" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}