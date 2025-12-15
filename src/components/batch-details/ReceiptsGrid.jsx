import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Clock, XCircle, FileText, Trash2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const statusConfig = {
  pending: { label: "ממתין", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "אושר", color: "bg-green-100 text-green-800", icon: CheckCircle },
  rejected: { label: "נדחה", color: "bg-red-100 text-red-800", icon: XCircle }
};

export default function ReceiptsGrid({ 
  receipts, 
  onSelectReceipt, 
  onDeleteReceipt, 
  showStatus,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll
}) {
  const isPDF = (url) => url?.toLowerCase().endsWith('.pdf');
  const allSelected = receipts.length > 0 && receipts.every(r => selectedIds.includes(r.id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            {onToggleSelect && (
              <TableHead className="w-12">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onToggleSelectAll}
                    className={someSelected ? "data-[state=checked]:bg-blue-600" : ""}
                  />
                </div>
              </TableHead>
            )}
            <TableHead className="text-right w-16">סוג</TableHead>
            <TableHead className="text-right">ספק</TableHead>
            <TableHead className="text-right hidden md:table-cell">תאריך</TableHead>
            <TableHead className="text-right">סכום</TableHead>
            {showStatus && <TableHead className="text-right hidden md:table-cell">סטטוס</TableHead>}
            <TableHead className="text-left w-16">פעולות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((receipt) => {
            const status = statusConfig[receipt.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const isReceiptPDF = isPDF(receipt.receipt_image_url);
            const isSelected = selectedIds.includes(receipt.id);
            const isIncome = receipt.type === 'income';

            return (
              <TableRow 
                key={receipt.id} 
                className={`hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                onClick={() => onSelectReceipt(receipt)}
              >
                {onToggleSelect && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(receipt.id)}
                      />
                    </div>
                  </TableCell>
                )}
                <TableCell>
                    <div className="flex items-center justify-center">
                        {isIncome ? (
                            <ArrowUpCircle className="w-5 h-5 text-green-600" />
                        ) : (
                            <ArrowDownCircle className="w-5 h-5 text-red-600" />
                        )}
                    </div>
                </TableCell>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                        {receipt.receipt_image_url && (
                            <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                            {isReceiptPDF ? (
                                <FileText className="w-5 h-5 text-slate-400" />
                            ) : (
                                <img
                                src={receipt.receipt_image_url}
                                alt="Receipt"
                                className="w-full h-full object-cover"
                                />
                            )}
                            </div>
                        )}
                        <div>
                            {receipt.vendor_name}
                            <div className="md:hidden text-xs text-slate-500 mt-0.5">
                                {format(new Date(receipt.date), "d/M/yyyy", { locale: he })}
                            </div>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="text-slate-600 hidden md:table-cell">
                  {format(new Date(receipt.date), "d/M/yyyy", { locale: he })}
                </TableCell>
                <TableCell>
                  <span className={`font-bold ${isIncome ? 'text-green-700' : 'text-slate-900'}`}>
                    ₪{receipt.total_amount?.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                  </span>
                </TableCell>
                {showStatus && (
                  <TableCell className="hidden md:table-cell">
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
                      className="h-8 w-8 hover:bg-red-50 hover:text-red-600 rounded-lg"
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