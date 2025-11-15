import React, { useRef, useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
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

export default function UploadSection({ batchId, onReceiptProcessed }) {
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
    <Card className="border-none shadow-2xl shadow-slate-200/50">
      <CardContent className="p-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          disabled={isProcessing}
          className="hidden"
        />

        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="w-full h-16 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 ml-2 animate-spin" />
              מעבד קבלה...
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 ml-2" />
              העלה קבלה
            </>
          )}
        </Button>

        {isProcessing && (
          <Progress value={progress} className="mt-4 h-2" />
        )}
      </CardContent>
    </Card>
  );
}