import React, { useState, useRef } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileImage, Loader2, CheckCircle, X, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    vendor_name: {
      type: "string",
      description: "שם העסק או הספק"
    },
    receipt_number: {
      type: "string",
      description: "מספר קבלה או חשבונית"
    },
    date: {
      type: "string",
      format: "date",
      description: "תאריך הקבלה בפורמט YYYY-MM-DD"
    },
    total_amount: {
      type: "number",
      description: "סכום כולל"
    },
    vat_amount: {
      type: "number",
      description: "סכום מעם"
    },
    currency: {
      type: "string",
      description: "מטבע"
    },
    payment_method: {
      type: "string",
      description: "אמצעי תשלום"
    },
    category: {
      type: "string",
      description: "קטגוריה"
    },
    line_items: {
      type: "array",
      description: "פריטים בקבלה",
      items: {
        type: "object",
        properties: {
          description: {
            type: "string"
          },
          quantity: {
            type: "number"
          },
          unit_price: {
            type: "number"
          },
          total: {
            type: "number"
          }
        }
      }
    }
  },
  required: ["vendor_name", "date", "total_amount"]
};

export default function UploadSection({ batchId, onReceiptProcessed }) {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState({});
  const [progress, setProgress] = useState({});
  const [errors, setErrors] = useState({});
  const [processedData, setProcessedData] = useState({});
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    const newFiles = selectedFiles.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    
    // Process files one by one
    for (const fileObj of newFiles) {
      await processFile(fileObj);
    }
  };

  const processFile = async (fileObj) => {
    const { file, id } = fileObj;
    setProcessing(prev => ({ ...prev, [id]: true }));
    setProgress(prev => ({ ...prev, [id]: 10 }));
    setErrors(prev => ({ ...prev, [id]: null }));

    try {
      // Upload
      setProgress(prev => ({ ...prev, [id]: 30 }));
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Extract data
      setProgress(prev => ({ ...prev, [id]: 60 }));
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `אנא נתח את הקבלה או החשבונית הזו ותחלץ את כל המידע הרלוונטי.
        
חשוב במיוחד:
- זהה את שם העסק/הספק (vendor_name)
- מספר קבלה/חשבונית (receipt_number)
- תאריך (date) - בפורמט YYYY-MM-DD בדיוק
- סכום כולל (total_amount) - מספר
- סכום מע"ם (vat_amount) - מספר
- מטבע (currency) - ברירת מחדל ILS
- אמצעי תשלום (payment_method)
- קטגוריה (category)
- כל הפריטים/שורות בקבלה (line_items) עם:
  * תיאור (description)
  * כמות (quantity) - מספר
  * מחיר יחידה (unit_price) - מספר
  * סה"כ (total) - מספר
  
חשב את הסכומים הכוללים בדיוק. אם זה PDF, קרא את כל הטקסט בקובץ.

החזר רק JSON תקין ללא טקסט נוסף.`,
        file_urls: [file_url],
        response_json_schema: RECEIPT_SCHEMA
      });

      setProgress(prev => ({ ...prev, [id]: 100 }));
      
      const extractedData = {
        ...result,
        receipt_image_url: file_url,
        batch_id: batchId,
        status: 'pending'
      };
      
      // Store processed data
      setProcessedData(prev => ({ ...prev, [id]: extractedData }));
      
      // Open review modal
      onReceiptProcessed(extractedData);

    } catch (error) {
      console.error("Error processing file:", error);
      setErrors(prev => ({ 
        ...prev, 
        [id]: error.message || "שגיאה בעיבוד הקובץ. אנא נסה שוב."
      }));
    } finally {
      setProcessing(prev => ({ ...prev, [id]: false }));
    }
  };

  const removeFile = (fileObj) => {
    setFiles(prev => prev.filter(f => f.id !== fileObj.id));
    setProcessing(prev => {
      const newState = { ...prev };
      delete newState[fileObj.id];
      return newState;
    });
    setProgress(prev => {
      const newState = { ...prev };
      delete newState[fileObj.id];
      return newState;
    });
    setErrors(prev => {
      const newState = { ...prev };
      delete newState[fileObj.id];
      return newState;
    });
    setProcessedData(prev => {
      const newState = { ...prev };
      delete newState[fileObj.id];
      return newState;
    });
  };

  const retryFile = (fileObj) => {
    setErrors(prev => ({ ...prev, [fileObj.id]: null }));
    processFile(fileObj);
  };

  const reviewAgain = (fileObj) => {
    const data = processedData[fileObj.id];
    if (data) {
      onReceiptProcessed(data);
    }
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
          <p className="text-sm text-slate-500">ניתן להעלות מספר קבלות בו זמנית (תמונות או PDF)</p>
        </div>

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            {files.map((fileObj) => {
              const { file, id } = fileObj;
              const isProcessing = processing[id];
              const fileProgress = progress[id] || 0;
              const error = errors[id];
              const hasProcessedData = !!processedData[id];

              return (
                <div
                  key={id}
                  className={`rounded-xl border transition-all ${
                    error ? 'border-red-500 bg-red-50' :
                    isProcessing ? 'border-blue-500 bg-blue-50' : 
                    hasProcessedData ? 'border-green-500 bg-green-50' :
                    'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    <FileImage className={`w-8 h-8 flex-shrink-0 ${
                      error ? 'text-red-500' :
                      isProcessing ? 'text-blue-500' :
                      hasProcessedData ? 'text-green-500' :
                      'text-slate-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      
                      {isProcessing && (
                        <div className="mt-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-slate-600">מעבד עם AI...</span>
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          </div>
                          <Progress value={fileProgress} className="h-1.5" />
                        </div>
                      )}
                      
                      {hasProcessedData && !error && (
                        <div className="flex items-center gap-1 text-sm text-green-700 mt-1 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          עובד - לחץ לעיון חוזר
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {hasProcessedData && !isProcessing && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reviewAgain(fileObj)}
                          className="text-xs"
                        >
                          עיון חוזר
                        </Button>
                      )}
                      {error && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryFile(fileObj)}
                          className="text-xs"
                        >
                          נסה שוב
                        </Button>
                      )}
                      {!isProcessing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(fileObj)}
                          className="h-8 w-8"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {error && (
                    <div className="px-4 pb-4">
                      <Alert variant="destructive" className="bg-red-100 border-red-300">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-sm">{error}</AlertDescription>
                      </Alert>
                    </div>
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