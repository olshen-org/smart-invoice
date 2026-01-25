import { useState } from 'react';
import { api } from './apiClient';

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
    notes: { type: "string", description: "הערות ומידע נוסף שלא מופה לשדות אחרים" },
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

// Prompt is now defined on the server (server/index.js DEFAULT_EXTRACTION_PROMPT)
// Edit it there to change extraction behavior for all clients

export function useReceiptUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadAndExtract = async (file) => {
    setIsProcessing(true);
    setProgress(10);
    setError(null);

    try {
      // Upload file
      setProgress(30);
      const { file_url } = await api.integrations.Core.UploadFile({ file });

      setProgress(60);

      // Extract data using AI (uses server-side default prompt)
      const result = await api.integrations.Core.InvokeLLM({
        file_urls: [file_url],
        response_json_schema: RECEIPT_SCHEMA
      });

      setProgress(100);

      return {
        ...result,
        receipt_image_url: file_url
      };
    } catch (err) {
      console.error("Error processing receipt:", err);
      setError("שגיאה בעיבוד הקבלה. אנא נסה שוב.");
      throw err;
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 500);
    }
  };

  // Reprocess an existing image URL with Gemini
  const reprocessFromUrl = async (imageUrl) => {
    setIsProcessing(true);
    setProgress(30);
    setError(null);

    try {
      setProgress(60);

      // Extract data using AI with existing URL (uses server-side default prompt)
      const result = await api.integrations.Core.InvokeLLM({
        file_urls: [imageUrl],
        response_json_schema: RECEIPT_SCHEMA
      });

      setProgress(100);

      return {
        ...result,
        receipt_image_url: imageUrl
      };
    } catch (err) {
      console.error("Error reprocessing receipt:", err);
      setError("שגיאה בעיבוד מחדש. אנא נסה שוב.");
      throw err;
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProgress(0), 500);
    }
  };

  return {
    uploadAndExtract,
    reprocessFromUrl,
    isProcessing,
    progress,
    error,
    setError
  };
}
