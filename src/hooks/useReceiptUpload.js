import { useState } from 'react';
import { api } from '@/api/apiClient';

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

const EXTRACTION_PROMPT = `אנא נתח את הקבלה או החשבונית הזו ותחלץ את כל המידע הרלוונטי.

חשוב מאוד - שמירה על השפה המקורית:
- כל הטקסט חייב להישאר בעברית כפי שהוא מופיע במסמך
- אל תתרגם שום דבר לאנגלית
- שמור את הטקסט העברי בדיוק כמו במקור
- לדוגמה: "רכב" צריך להישאר "רכב" ולא "Vehicle"

חשוב במיוחד:
- זהה את שם העסק/הספק (vendor_name) - בעברית
- מספר קבלה/חשבונית (receipt_number)
- תאריך (date) - בפורמט YYYY-MM-DD בדיוק
- סכום כולל (total_amount) - מספר
- סכום מע"ם (vat_amount) - מספר
- מטבע (currency) - ברירת מחדל ILS
- אמצעי תשלום (payment_method) - בעברית
- קטגוריה (category) - בעברית
- כל הפריטים/שורות בקבלה (line_items) עם:
  * תיאור (description) - בעברית בדיוק כמו במקור
  * כמות (quantity) - מספר
  * מחיר יחידה (unit_price) - מספר
  * סה"כ (total) - מספר

חשב את הסכומים הכוללים בדיוק. אם זה PDF, קרא את כל הטקסט בקובץ.

החזר רק JSON תקין ללא טקסט נוסף.`;

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

      // Extract data using AI
      const result = await api.integrations.Core.InvokeLLM({
        prompt: EXTRACTION_PROMPT,
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

  return {
    uploadAndExtract,
    isProcessing,
    progress,
    error,
    setError
  };
}
