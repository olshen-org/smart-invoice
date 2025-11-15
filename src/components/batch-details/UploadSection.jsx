import React, { useState, useRef } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileImage, Loader2, CheckCircle, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function UploadSection({ batchId, onReceiptProcessed }) {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState({});
  const [progress, setProgress] = useState({});
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]);
    
    // Process files one by one
    for (const file of selectedFiles) {
      await processFile(file);
    }
  };

  const processFile = async (file) => {
    const fileId = `${file.name}-${Date.now()}`;
    setProcessing(prev => ({ ...prev, [fileId]: true }));
    setProgress(prev => ({ ...prev, [fileId]: 10 }));

    try {
      // Upload
      setProgress(prev => ({ ...prev, [fileId]: 30 }));
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Extract data
      setProgress(prev => ({ ...prev, [fileId]: 60 }));
      const schema = await base44.entities.Receipt.schema();
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `אנא נתח את הקבלה או החשבונית הזו ותחלץ את כל המידע הרלוונטי.
        
חשוב במיוחד:
- זהה את שם העסק/הספק
- מספר קבלה/חשבונית
- תאריך (בפורמט YYYY-MM-DD)
- סכום כולל
- סכום מע"ם (אם קיים)
- מטבע (ברירת מחדל ILS)
- אמצעי תשלום
- כל הפריטים/שורות בקבלה עם כמות, מחיר יחידה וסכום
- חשב את הסכומים הכוללים בדיוק`,
        file_urls: [file_url],
        response_json_schema: schema
      });

      setProgress(prev => ({ ...prev, [fileId]: 100 }));
      
      // Pass to review modal
      onReceiptProcessed({
        ...result,
        receipt_image_url: file_url,
        batch_id: batchId,
        status: 'pending'
      });

      // Remove from list after a delay
      setTimeout(() => {
        setFiles(prev => prev.filter(f => f !== file));
        setProcessing(prev => {
          const newState = { ...prev };
          delete newState[fileId];
          return newState;
        });
        setProgress(prev => {
          const newState = { ...prev };
          delete newState[fileId];
          return newState;
        });
      }, 1000);

    } catch (error) {
      console.error("Error processing file:", error);
      setProcessing(prev => ({ ...prev, [fileId]: false }));
    }
  };

  const removeFile = (file) => {
    setFiles(prev => prev.filter(f => f !== file));
  };

  return (
    <Card className="border-none shadow-2xl shadow-slate-200/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          העלאת קבלות
        </CardTitle>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer text-center"
        >
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <FileImage className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">גרור קבצים או לחץ לבחירה</h3>
          <p className="text-sm text-slate-500">ניתן להעלות מספר קבלות בו זמנית</p>
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            {files.map((file, index) => {
              const fileId = `${file.name}-${Date.now()}`;
              const isProcessing = processing[fileId];
              const fileProgress = progress[fileId] || 0;

              return (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                    isProcessing ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                  }`}
                >
                  <FileImage className="w-8 h-8 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{file.name}</p>
                    {isProcessing && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-slate-500">מעבד...</span>
                          <Loader2 className="w-3 h-3 animate-spin" />
                        </div>
                        <Progress value={fileProgress} className="h-1" />
                      </div>
                    )}
                    {fileProgress === 100 && (
                      <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                        <CheckCircle className="w-4 h-4" />
                        הושלם
                      </div>
                    )}
                  </div>
                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}