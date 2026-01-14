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

const EXTRACTION_PROMPT = `אתה מערכת חשבונאית מדויקת. נתח את המסמך הזה (קבלה, חשבונית, או חשבונית מס) וחלץ את הנתונים המדויקים.

⚠️ כללי דיוק קריטיים - זו מערכת הנהלת חשבונות!
1. חלץ את המספרים בדיוק כפי שמופיעים במסמך - אל תעגל ואל תחשב מחדש
2. אם מספר מופיע כשלילי (זיכוי, החזר) - שמור אותו כשלילי
3. מע"מ בישראל הוא 18% - אבל תמיד חלץ את הסכום המדויק מהמסמך

📋 מבנה חשבונית ישראלית תקנית:
- פריטים (line_items) = סכומים לפני מע"מ (נטו)
- סכום מע"מ (vat_amount) = מופיע בנפרד
- סכום כולל (total_amount) = סכום פריטים + מע"מ

🔍 שדות לחילוץ:

vendor_name: שם העסק/הספק - בעברית כפי שמופיע
receipt_number: מספר חשבונית/קבלה
date: תאריך בפורמט YYYY-MM-DD בלבד
currency: מטבע (ברירת מחדל: ILS)
payment_method: אמצעי תשלום (מזומן/אשראי/העברה/וכו')
category: קטגוריה (office_supplies/utilities/travel/meals/equipment/services/rent/insurance/marketing/other)

line_items: מערך של כל הפריטים:
  - description: תיאור מפורט בעברית (כולל מק"ט, גודל, צבע אם רלוונטי)
  - quantity: כמות (מספר, יכול להיות שלילי לזיכוי)
  - unit_price: מחיר ליחידה לפני מע"מ (מספר, יכול להיות שלילי)
  - total: סה"כ לשורה = כמות × מחיר (לפני מע"מ)

vat_amount: סכום המע"מ המדויק כפי שמופיע במסמך
total_amount: הסכום הסופי לתשלום כולל מע"מ

notes: פרטים נוספים (מספר עוסק, כתובת, תנאי תשלום, וכו')

✅ בדיקה עצמית לפני החזרה:
- סכום כל הפריטים + מע"מ צריך להיות שווה ל-total_amount (עם סטייה מקסימלית של 0.10₪)
- אם יש אי-התאמה - חלץ את המספרים כפי שהם מופיעים במסמך

החזר JSON תקין בלבד, ללא טקסט נוסף.`;

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

  // Reprocess an existing image URL with Gemini
  const reprocessFromUrl = async (imageUrl) => {
    setIsProcessing(true);
    setProgress(30);
    setError(null);

    try {
      setProgress(60);

      // Extract data using AI with existing URL
      const result = await api.integrations.Core.InvokeLLM({
        prompt: EXTRACTION_PROMPT,
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
