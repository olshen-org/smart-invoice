import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useReceiptUpload } from "@/lib/useReceiptUpload";

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

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const result = await uploadAndExtract(file);

      onReceiptProcessed({
        ...result,
        batch_id: batchId,
        status: 'pending'
      });
    } catch (error) {
      alert("שגיאה בעיבוד הקבלה");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={handleFileSelect}
        disabled={isProcessing}
        className="hidden"
      />

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              מעבד...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 ml-2" />
              העלה קבלה
            </>
          )}
        </Button>

        {isProcessing && (
          <div className="flex-1 w-full">
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {selectedCount > 0 && (
          <>
            <div className="flex-1 hidden md:block" />
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
              <span className="text-sm text-slate-600 text-center md:text-right">
                <strong>{selectedCount}</strong> נבחרו
              </span>
              <div className="flex gap-2 justify-between md:justify-start">
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}