import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import UploadZone from "../components/upload/UploadZone";
import ReceiptPreview from "../components/upload/ReceiptPreview";

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileSelected = async (selectedFile) => {
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

      // Extract data using Gemini via InvokeLLM
      setUploadProgress(70);
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
- חשב את הסכומים הכוללים בדיוק

אם יש פריטים מרובים, ודא שסכום total_amount שווה לסכום כל הפריטים.`,
        file_urls: [file_url],
        response_json_schema: schema
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
      await base44.entities.Receipt.create(finalData);
      navigate(createPageUrl("Dashboard"));
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