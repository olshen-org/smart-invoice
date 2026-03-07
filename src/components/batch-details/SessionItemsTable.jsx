import React, { useState } from 'react';

const VAT_STATES = ['flag', 'taxable', 'exempt'];
const VAT_LABELS = { flag: '❓ בדיקה', taxable: '18%', exempt: '0% פטור' };
const VAT_STYLES = {
  flag:    'bg-amber-100 text-amber-800 border border-amber-300',
  taxable: 'bg-blue-100 text-blue-800 border border-blue-300',
  exempt:  'bg-emerald-100 text-emerald-800 border border-emerald-300',
  'n/a':   'bg-slate-100 text-slate-500 border border-slate-200',
};

function VATToggle({ item, onUpdate }) {
  function next() {
    const idx = VAT_STATES.indexOf(item.vat_status);
    const newStatus = VAT_STATES[(idx + 1) % VAT_STATES.length];
    const total = Math.abs(item.total);
    const reclassified = newStatus === 'taxable'
      ? { ...item, vat_status: 'taxable', pre_vat: +(total / 1.18).toFixed(2), vat_amount: +(total - total / 1.18).toFixed(2) }
      : { ...item, vat_status: newStatus, pre_vat: total, vat_amount: 0 };
    onUpdate(reclassified);
  }

  const isItem = item.row_type === 'item';
  const status = item.vat_status || 'n/a';

  return (
    <button
      onClick={isItem ? next : undefined}
      className={`text-xs font-bold px-2 py-1 rounded-full ${VAT_STYLES[status] || VAT_STYLES['n/a']} ${isItem ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
    >
      {VAT_LABELS[status] || '—'}
    </button>
  );
}

async function fetchVATClassification(itemName) {
  const res = await fetch('/api/classify-vat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_name: itemName }),
  });
  if (!res.ok) throw new Error('Classification failed');
  return res.json();
}

function VATLookupButton({ item, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleLookup() {
    setLoading(true);
    setResult(null);
    try {
      const data = await fetchVATClassification(item.name);
      setResult(data);
      // Auto-apply if high confidence
      if (data.confidence === 'high') {
        const newStatus = data.vat_rate === 0 ? 'exempt' : 'taxable';
        const total = Math.abs(item.total);
        const updated = newStatus === 'taxable'
          ? { ...item, vat_status: 'taxable', pre_vat: +(total / 1.18).toFixed(2), vat_amount: +(total - total / 1.18).toFixed(2) }
          : { ...item, vat_status: 'exempt', pre_vat: total, vat_amount: 0 };
        onUpdate(updated);
      }
    } catch {
      setResult({ error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={handleLookup}
        disabled={loading}
        className="text-xs px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        title="בדוק סיווג מע״מ עם AI"
      >
        {loading ? '⏳' : '🔍'}
      </button>
      {result && !result.error && (
        <span className={`text-xs ${result.confidence === 'high' ? 'text-emerald-600' : 'text-amber-600'}`}
          title={result.reason}>
          {result.vat_rate === 0 ? '0%' : '18%'} {result.confidence === 'high' ? '✓' : '?'}
        </span>
      )}
      {result?.error && <span className="text-xs text-red-500">שגיאה</span>}
    </span>
  );
}

export default function SessionItemsTable({ items, onUpdateItem }) {
  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        העלה קבלה כדי לראות פריטים
      </div>
    );
  }

  function rowClass(item) {
    if (item.confidence === 'low') return 'border-l-4 border-red-300 bg-red-50';
    if (item.vat_status === 'flag') return 'border-l-4 border-amber-400 bg-amber-50';
    if (item.row_type === 'discount') return 'text-slate-400 italic';
    if (item.row_type === 'deposit') return 'text-slate-400';
    return '';
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-2 text-right font-medium">#</th>
            <th className="px-3 py-2 text-right font-medium">פריט</th>
            <th className="px-3 py-2 text-right font-medium">כמות</th>
            <th className="px-3 py-2 text-right font-medium">מחיר יח'</th>
            <th className="px-3 py-2 text-right font-medium">סה"כ</th>
            <th className="px-3 py-2 text-right font-medium">מע"מ</th>
            <th className="px-3 py-2 text-right font-medium">לפני מע"מ</th>
            <th className="px-3 py-2 text-right font-medium">סכום מע"מ</th>
            <th className="px-3 py-2 text-right font-medium">ביטחון</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item._id || idx} className={`border-b border-slate-100 ${rowClass(item)}`}>
              <td className="px-3 py-2 text-slate-400 tabular-nums" dir="ltr">{idx + 1}</td>
              <td className="px-3 py-2 max-w-[200px]">
                <div className="flex items-center gap-1">
                  {item.marked && (
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" title="מסומן בקבלה" />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums" dir="ltr">{item.quantity ?? 1}</td>
              <td className="px-3 py-2 tabular-nums" dir="ltr">
                {item.unit_price != null ? `₪${Number(item.unit_price).toFixed(2)}` : '—'}
              </td>
              <td className="px-3 py-2 tabular-nums font-medium" dir="ltr">
                ₪{Number(item.total || 0).toFixed(2)}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <VATToggle item={item} onUpdate={onUpdateItem} />
                  {item.vat_status === 'flag' && item.row_type === 'item' && (
                    <VATLookupButton item={item} onUpdate={onUpdateItem} />
                  )}
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums" dir="ltr">
                {item.pre_vat != null ? `₪${Number(item.pre_vat).toFixed(2)}` : '—'}
              </td>
              <td className="px-3 py-2 tabular-nums" dir="ltr">
                {item.vat_amount != null ? `₪${Number(item.vat_amount).toFixed(2)}` : '—'}
              </td>
              <td className="px-3 py-2">
                {item.confidence === 'low' && <span className="text-xs text-red-500">נמוך</span>}
                {item.confidence === 'medium' && <span className="text-xs text-amber-500">בינוני</span>}
                {item.confidence === 'high' && <span className="text-xs text-emerald-600">גבוה</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
