import React, { useRef, useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    vendor_name: { type: "string", description: "שם העסק או הספק" },
    receipt_number: { type: "string", description: "מספר קבלה או חשבונית" },
    date: { type: "string", format: "date", description: "תאריך הקבלה בפורמט YYYY-MM-DD" },
    total_amount: { type: "number", description: "סכום כולל" },
    vat_amount: { type: "number", description: "סכום מעם" },
    currency: { type: "string", description: "מטבע" },
    payment_method: { type: "string", description: "אמצעי תשלום" },
    category: { type: "string", description: "קטגוריה" },
    line_items: {
      type: "array",
      description: "פריטים בקבלה",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit_price: { type: "number" },
          total: { type: "number" }
        }
      }
    }
  },
  required: ["vendor_name", "date", "total_amount"]
};

export default function UploadSection({ 
  batchId, 
  onReceiptProcessed,
  selectedCount = 0,
  onApproveAll,
  onRejectAll,
  onDeleteAll
}) {
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);

    try {
      setProgress(30);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      setProgress(60);
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
- כל הפריטים/שורות בקבלה (line_items)

חשב את הסכומים הכוללים בדיוק. אם זה PDF, קרא את כל הטקסט בקובץ.`,
        file_urls: [file_url],
        response_json_schema: RECEIPT_SCHEMA
      });

      setProgress(100);
      
      onReceiptProcessed({
        ...result,
        receipt_image_url: file_url,
        batch_id: batchId,
        status: 'pending'
      });

    } catch (error) {
      console.error("Error:", error);
      alert("שגיאה בעיבוד הקבלה");
    } finally {
      setIsProcessing(false);
      setProgress(0);
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