import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const statusConfig = {
  pending: { label: "ממתין", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "אושר", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "נדחה", color: "bg-red-100 text-red-800", icon: XCircle }
};

export default function ReceiptsGrid({ receipts, onSelectReceipt, showStatus }) {
  const isPDF = (url) => url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="grid grid-cols-1 gap-4">
      {receipts.map((receipt) => {
        const status = statusConfig[receipt.status] || statusConfig.pending;
        const StatusIcon = status.icon;
        const isReceiptPDF = isPDF(receipt.receipt_image_url);

        return (
          <Card
            key={receipt.id}
            className="border-none shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer"
            onClick={() => onSelectReceipt(receipt)}
          >
            <CardContent className="p-4">
              <div className="flex gap-4">
                {receipt.receipt_image_url && (
                  <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50 flex items-center justify-center">
                    {isReceiptPDF ? (
                      <FileText className="w-10 h-10 text-red-500" />
                    ) : (
                      <img
                        src={receipt.receipt_image_url}
                        alt="Receipt"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-slate-900 truncate">{receipt.vendor_name}</h3>
                    {showStatus && (
                      <Badge className={`${status.color} border-0 flex items-center gap-1 flex-shrink-0`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">תאריך:</span>
                      <span className="font-medium">
                        {format(new Date(receipt.date), "d MMM yyyy", { locale: he })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">סכום:</span>
                      <span className="font-bold text-slate-900">
                        ₪{receipt.total_amount?.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}