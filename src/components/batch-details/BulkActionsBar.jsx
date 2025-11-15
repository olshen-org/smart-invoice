import React from 'react';
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Trash2, X } from "lucide-react";

export default function BulkActionsBar({ 
  selectedCount, 
  onApproveAll, 
  onRejectAll, 
  onDeleteAll,
  onClear 
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-slate-900 text-white rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold">{selectedCount}</span>
          <span className="text-slate-300">נבחרו</span>
        </div>
        
        <div className="h-6 w-px bg-slate-700" />
        
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={onApproveAll}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle className="w-4 h-4 ml-1" />
            אשר הכל
          </Button>
          
          <Button
            size="sm"
            onClick={onRejectAll}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <XCircle className="w-4 h-4 ml-1" />
            דחה הכל
          </Button>
          
          <Button
            size="sm"
            onClick={onDeleteAll}
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4 ml-1" />
            מחק הכל
          </Button>
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          onClick={onClear}
          className="h-8 w-8 hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}