const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const HEBREW_EXTRACTION_PROMPT = `
אנא נתח את הקבלה הזו ותחלץ את כל המידע.

כללים חשובים:
- שמור טקסט עברי בעברית – אל תתרגם לאנגלית
- זהה כל שורת פריט, כולל הנחות (מספר שלילי) ופיקדונות
- אם יש שורות מסומנות עם מרקר/הדגשה צהובה – סמן marked: true
- לכל פריט נסה לזהות אם הוא ירק/פרי טרי לפי שמו (possibly_exempt)
- ברקוד: ספרות בלבד
- vat_rate ברירת מחדל: 0.18 (18%)

החזר JSON תקין בלבד, ללא markdown ובלי טקסט נוסף:
{
  "store_name": "",
  "store_address": "",
  "date": "YYYY-MM-DD",
  "receipt_number": "",
  "total_amount": 0.00,
  "currency": "ILS",
  "line_items": [
    {
      "name": "",
      "barcode": "",
      "quantity": 1,
      "unit_price": 0.00,
      "total": 0.00,
      "row_type": "item|discount|deposit",
      "marked": false,
      "possibly_exempt": false,
      "confidence": "high|medium|low"
    }
  ]
}
`.trim();

async function extractReceipt(imageBuffer, mimeType) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.05 },
  });

  const result = await model.generateContent([
    HEBREW_EXTRACTION_PROMPT,
    { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
  ]);

  let text = result.response.text().replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  return JSON.parse(text);
}

async function classifyItemVAT(itemName) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });

  const prompt = `האם הפריט הבא חייב במע"מ בישראל (18%) או פטור ממע"מ (0% - פרי/ירק טרי)?
פריט: "${itemName}"
ענה JSON בלבד: {"vat_rate": 0 או 0.18, "reason": "הסבר קצר בעברית", "confidence": "high|medium|low"}`;

  const result = await model.generateContent([prompt]);
  let text = result.response.text().replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
  return JSON.parse(text);
}

module.exports = { extractReceipt, classifyItemVAT };
