import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, XCircle, FileText, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const statusConfig = {
  pending: { label: "ממתין", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "אושר", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "נדחה", color: "bg-red-100 text-red-800", icon: XCircle }
};

export default function ReceiptsGrid({ receipts, onSelectReceipt, onDeleteReceipt, showStatus }) {
  const isPDF = (url) => url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="text-right">תמונה</TableHead>
            <TableHead className="text-right">ספק</TableHead>
            <TableHead className="text-right">תאריך</TableHead>
            <TableHead className="text-right">סכום</TableHead>
            {showStatus && <TableHead className="text-right">סטטוס</TableHead>}
            <TableHead className="text-left w-16">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((receipt) => {
            const status = statusConfig[receipt.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const isReceiptPDF = isPDF(receipt.receipt_image_url);

            return (
              <TableRow 
                key={receipt.id} 
                className="hover:bg-slate-50 cursor-pointer"
                onClick={() => onSelectReceipt(receipt)}
              >
                <TableCell className="w-16">
                  {receipt.receipt_image_url && (
                    <div className="w-12 h-12 rounded border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
                      {isReceiptPDF ? (
                        <FileText className="w-6 h-6 text-red-500" />
                      ) : (
                        <img
                          src={receipt.receipt_image_url}
                          alt="Receipt"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{receipt.vendor_name}</TableCell>
                <TableCell className="text-slate-600">
                  {format(new Date(receipt.date), "d/M/yyyy", { locale: he })}
                </TableCell>
                <TableCell className="font-bold">
                  ₪{receipt.total_amount?.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                </TableCell>
                {showStatus && (
                  <TableCell>
                    <Badge className={`${status.color} border-0 text-xs`}>
                      <StatusIcon className="w-3 h-3 ml-1" />
                      {status.label}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>
                  {onDeleteReceipt && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('האם למחוק קבלה זו?')) {
                          onDeleteReceipt(receipt.id);
                        }
                      }}
                      className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}