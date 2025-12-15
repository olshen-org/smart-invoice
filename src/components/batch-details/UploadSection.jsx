import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle, XCircle, Trash2, FileUp, Image as ImageIcon, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useReceiptUpload } from "@/lib/useReceiptUpload";
import { cn } from "@/lib/utils";

export default function UploadSection({
  batchId,
  onReceiptProcessed,
  selectedCount = 0,
  onApproveAll,
  onRejectAll,
  onDeleteAll
}) {
  const fileInputRef = useRef(null);
  const { uploadAndExtract, isProcessing, progress } = useReceiptUpload();
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const processFile = async (file) => {
    if (!file) return;

    try {
      const result = await uploadAndExtract(file);

      onReceiptProcessed({
        ...result,
        batch_id: batchId,
        status: 'pending',
        type: 'expense' // Default, user can change in review
      });
    } catch (error) {
      alert("שגיאה בעיבוד הקבלה");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        disabled={isProcessing}
        className="hidden"
      />

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={cn(
          "relative group cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 ease-in-out p-8 md:p-12 text-center",
          isDragging 
            ? "border-blue-500 bg-blue-50 scale-[1.01] shadow-lg" 
            : "border-slate-200 bg-white hover:border-blue-400 hover:bg-slate-50 hover:shadow-sm",
          isProcessing && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex flex-col items-center justify-center gap-4">
          {isProcessing ? (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">{progress}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900">מעבד קבלה...</h3>
                <p className="text-sm text-slate-500">אנא המתן בזמן שהמערכת מפענחת את הנתונים</p>
              </div>
            </div>
          ) : (
            <>
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-200",
                isDragging ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600"
              )}>
                <FileUp className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-slate-900">
                  {isDragging ? "שחרר את הקובץ כאן" : "לחץ להעלאה או גרור קובץ"}
                </h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                  תומך בקבצי תמונה (JPG, PNG) ומסמכי PDF
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> תמונות</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> PDF</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar - Only show if selection exists */}
      {selectedCount > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                {selectedCount} נבחרו
              </div>
              <span className="text-sm text-slate-500">פעולות מרובות:</span>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
              <Button
                size="sm"
                onClick={onApproveAll}
                className="bg-green-600 hover:bg-green-700 text-white flex-1 md:flex-none"
              >
                <CheckCircle className="w-4 h-4 ml-1" />
                אשר הכל
              </Button>
              <Button
                size="sm"
                onClick={onRejectAll}
                className="bg-orange-600 hover:bg-orange-700 text-white flex-1 md:flex-none"
              >
                <XCircle className="w-4 h-4 ml-1" />
                דחה הכל
              </Button>
              <Button
                size="sm"
                onClick={onDeleteAll}
                variant="destructive"
                className="flex-1 md:flex-none"
              >
                <Trash2 className="w-4 h-4 ml-1" />
                מחק הכל
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}