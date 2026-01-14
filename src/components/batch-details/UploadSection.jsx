import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Camera, FileUp } from "lucide-react";
import { useReceiptUpload } from "@/lib/useReceiptUpload";
import { cn } from "@/lib/utils";

export default function UploadSection({
  batchId,
  onReceiptProcessed
}) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const { uploadAndExtract, isProcessing, progress } = useReceiptUpload();
  const [processingType, setProcessingType] = useState(null); // 'camera' | 'file'

  const handleFileSelect = async (e, type) => {
    const file = e.target.files?.[0];
    if (file) {
      setProcessingType(type);
      await processFile(file);
    }
  };

  const processFile = async (file) => {
    if (!file) return;

    try {
      const result = await uploadAndExtract(file);

      onReceiptProcessed({
        ...result,
        batch_id: batchId,
        status: 'pending',
        type: 'expense'
      });
    } catch (error) {
      alert("שגיאה בעיבוד הקבלה");
    } finally {
      setProcessingType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Hidden Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => handleFileSelect(e, 'file')}
        disabled={isProcessing}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleFileSelect(e, 'camera')}
        disabled={isProcessing}
        className="hidden"
      />

      {/* Upload Buttons */}
      {isProcessing ? (
        <div className="flex items-center justify-center gap-4 py-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-600">{progress}%</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-slate-900">
              {processingType === 'camera' ? 'מעבד תמונה...' : 'מעבד קובץ...'}
            </p>
            <p className="text-sm text-slate-500">אנא המתן</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          {/* Camera Button - More prominent on mobile */}
          <Button
            onClick={() => cameraInputRef.current?.click()}
            className={cn(
              "flex-1 h-14 rounded-xl gap-2 text-base",
              "bg-blue-600 hover:bg-blue-700 text-white",
              "md:flex-none md:px-6"
            )}
          >
            <Camera className="w-5 h-5" />
            <span>צלם קבלה</span>
          </Button>

          {/* File Button */}
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex-1 h-14 rounded-xl gap-2 text-base",
              "border-slate-300 hover:bg-slate-50",
              "md:flex-none md:px-6"
            )}
          >
            <FileUp className="w-5 h-5" />
            <span>העלה קובץ</span>
          </Button>
        </div>
      )}

      {/* Supported formats hint */}
      <p className="text-xs text-slate-400 text-center">
        תמונות (JPG, PNG) או PDF
      </p>
    </div>
  );
}
