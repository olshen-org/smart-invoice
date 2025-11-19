import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import UploadZone from "../components/upload/UploadZone";
import ReceiptPreview from "../components/upload/ReceiptPreview";

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

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedBatchId, setSelectedBatchId] = useState("");

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.Batch.list("-created_date"),
    initialData: [],
  });

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const handleFileSelected = async (selectedFile) => {
    if (!selectedBatchId) {
      setError("נא לבחור אצווה לפני העלאת קבלה");
      return;
    }
    setFile(selectedFile);
    setError(null);
    setExtractedData(null);
    setIsProcessing(true);
    setUploadProgress(10);

    try {
      // Upload file
      setUploadProgress(30);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      setFileUrl(file_url);
      setUploadProgress(50);

      // Extract data using InvokeLLM
      setUploadProgress(70);
      
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

      setUploadProgress(100);
      setExtractedData({
        ...result,
        receipt_image_url: file_url
      });
    } catch (err) {
      console.error("Error processing receipt:", err);
      setError("שגיאה בעיבוד הקבלה. אנא נסה שוב.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async (finalData) => {
    setIsProcessing(true);
    try {
      await base44.entities.Receipt.create({
        ...finalData,
        batch_id: selectedBatchId
      });
      navigate(createPageUrl("BatchDetails") + `?id=${selectedBatchId}`);
    } catch (err) {
      setError("שגיאה בשמירת הקבלה. אנא נסה שוב.");
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setFileUrl(null);
    setExtractedData(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="rounded-xl"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">העלאת קבלה</h1>
            <p className="text-slate-500 mt-1">צלם או העלה קבלה לעיבוד אוטומטי</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!extractedData ? (
          <div className="space-y-6">
            <Card className="border-none shadow-lg shadow-blue-50">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label>בחר אצווה</Label>
                  <Select 
                    value={selectedBatchId} 
                    onValueChange={setSelectedBatchId}
                    disabled={isProcessing}
                  >
                    <SelectTrigger className="w-full md:w-1/2 text-right" dir="rtl">
                      <SelectValue placeholder="בחר אצווה..." />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batch_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {batches.length === 0 && !batchesLoading && (
                     <p className="text-sm text-red-500">אין אצוות פתוחות. נא צור אצווה חדשה בלוח האצוות.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-2xl shadow-blue-100/50">
              <CardHeader>
                <CardTitle className="text-xl font-bold">העלאת מסמך</CardTitle>
              </CardHeader>
              <CardContent>
                <UploadZone 
                  onFileSelected={handleFileSelected}
                  isProcessing={isProcessing}
                  progress={uploadProgress}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <ReceiptPreview 
            extractedData={extractedData}
            fileUrl={fileUrl}
            onSave={handleSave}
            onCancel={handleCancel}
            isProcessing={isProcessing}
          />
        )}
      </div>
    </div>
  );
}