import { useState, useRef } from 'react';
import { api } from '@/lib/apiClient';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { classifyVATItems, calcSessionSummary } from '@/lib/vatClassifier';
import SessionItemsTable from './SessionItemsTable';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

function AgentPanel({ messages }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-3">
      <div className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-2">
        🤖 סוכן החשבונית
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className="text-xs text-slate-600 leading-relaxed">{msg}</div>
        ))}
        {messages.length === 0 && (
          <div className="text-xs text-slate-400">העלה קבלה להתחיל...</div>
        )}
      </div>
    </div>
  );
}

export default function ClientSessionView({ batch }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [sessionReceipts, setSessionReceipts] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [agentMessages, setAgentMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [vatOverrides, setVatOverrides] = useState({});
  const [isCommitting, setIsCommitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const addAgentMessage = (msg) => setAgentMessages(prev => [...prev, msg]);

  async function handleUpload(file) {
    if (!file) return;
    setIsProcessing(true);
    addAgentMessage(`מעבד קבלה ${sessionReceipts.length + 1}...`);

    try {
      // 1. Upload to Drive
      const { file_url } = await api.integrations.Core.UploadFile({ file });

      // 2. Extract via Gemini (Vertex)
      const extracted = await api.integrations.Core.InvokeLLM({ file_urls: [file_url] });

      // 3. Classify VAT on items
      const rawItems = extracted.line_items || [];
      const classified = classifyVATItems(rawItems);

      // 4. Apply any existing session overrides
      const receiptId = uid();
      const withOverrides = classified.map(item =>
        vatOverrides[item.name]
          ? { ...item, vat_status: vatOverrides[item.name] }
          : item
      );
      const itemsWithSource = withOverrides.map(item => ({ ...item, _id: uid(), receipt_source_id: receiptId }));

      // 5. Add to session state
      const receipt = { id: receiptId, file_url, extracted, items: itemsWithSource, status: 'pending' };
      setSessionReceipts(prev => [...prev, receipt]);
      setAllItems(prev => [...prev, ...itemsWithSource]);

      // 6. Agent report
      const flaggedCount = itemsWithSource.filter(i => i.vat_status === 'flag').length;
      const lowCount = itemsWithSource.filter(i => i.confidence === 'low').length;
      const markedCount = itemsWithSource.filter(i => i.marked).length;
      const summary = calcSessionSummary(itemsWithSource);

      if (markedCount > 0) {
        addAgentMessage(`זוהו ${markedCount} שורות מסומנות בקבלה. מוצגות בצהוב.`);
      } else {
        addAgentMessage(`לא זוהה סימון מרקר — כל שורות הקבלה עובדו.`);
      }

      addAgentMessage(
        `נמצאו ${itemsWithSource.length} פריטים.` +
        (flaggedCount ? ` ⚠️ ${flaggedCount} לבדיקה.` : '') +
        (lowCount ? ` 📷 ${lowCount} לא נקראו.` : '') +
        ` מע"מ מחושב: ₪${summary.vatTotal.toFixed(2)}`
      );

    } catch (err) {
      console.error('Upload error:', err);
      addAgentMessage(`שגיאה בעיבוד: ${err.message}`);
      toast.error('שגיאה בעיבוד הקבלה');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleFileInput(e) {
    const file = e.target.files[0];
    if (file) handleUpload(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleVATUpdate(updatedItem) {
    // Session-level learning: remember this override for future receipts
    setVatOverrides(prev => ({ ...prev, [updatedItem.name]: updatedItem.vat_status }));

    // Apply to all items with the same name
    setAllItems(prev => prev.map(item =>
      item.name === updatedItem.name && item.row_type === 'item'
        ? { ...item, vat_status: updatedItem.vat_status, pre_vat: updatedItem.pre_vat, vat_amount: updatedItem.vat_amount }
        : item
    ));
  }

  async function commitSession() {
    const flaggedCount = allItems.filter(i => i.vat_status === 'flag' && i.row_type === 'item').length;
    if (flaggedCount > 0) {
      if (!confirm(`יש ${flaggedCount} פריטים שעדיין לבדיקה. האם להמשיך בכל זאת?`)) return;
    }

    setIsCommitting(true);
    try {
      // Group items by source receipt
      const byReceipt = {};
      allItems.forEach(item => {
        const src = item.receipt_source_id;
        if (!byReceipt[src]) byReceipt[src] = [];
        byReceipt[src].push(item);
      });

      for (const [sourceId, items] of Object.entries(byReceipt)) {
        const src = sessionReceipts.find(r => r.id === sourceId);
        const approvedItems = items.filter(i => i.vat_status !== 'flag' && i.row_type === 'item');
        const total = approvedItems.reduce((sum, i) => sum + (i.total || 0), 0);
        const vatAmount = approvedItems.reduce((sum, i) => sum + (i.vat_amount || 0), 0);

        await api.entities.Receipt.create({
          batch_id: batch.id,
          vendor_name: src?.extracted?.store_name || 'לא ידוע',
          date: src?.extracted?.date || new Date().toISOString().split('T')[0],
          total_amount: total,
          vat_amount: vatAmount,
          status: 'approved',
          type: 'expense',
          receipt_image_url: src?.file_url || '',
          line_items: JSON.stringify(approvedItems),
        });
      }

      // Mark batch as completed
      await api.entities.Batch.update(batch.id, {
        status: 'completed',
        lifecycle_stage: 'completed',
      });

      toast.success('הסשן נסגר בהצלחה');
      navigate(createPageUrl('BatchDetails') + `?id=${batch.id}&report=1`);
    } catch (err) {
      console.error('Commit error:', err);
      toast.error('שגיאה בסגירת הסשן: ' + err.message);
    } finally {
      setIsCommitting(false);
    }
  }

  const summary = calcSessionSummary(allItems);
  const flaggedItems = allItems.filter(i => i.vat_status === 'flag' && i.row_type === 'item');

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Batches'))} className="rounded-full">
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                👤 {batch.client_name || batch.batch_name}
              </h1>
              <p className="text-xs text-slate-500">סשן לקוח · {sessionReceipts.length} קבלות</p>
            </div>
          </div>
          <Button
            onClick={commitSession}
            disabled={allItems.length === 0 || isCommitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4"
          >
            {isCommitting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
            אשרי וסגרי סשן
          </Button>
        </div>
      </div>

      {/* Session Summary Bar */}
      {allItems.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4 text-sm">
            <span className="text-slate-600">חייב מע"מ: <strong>₪{summary.taxableBase.toFixed(2)}</strong></span>
            <span className="text-blue-700">מע"מ 18%: <strong>₪{summary.vatTotal.toFixed(2)}</strong></span>
            {summary.exemptTotal > 0 && (
              <span className="text-emerald-700">פטור: <strong>₪{summary.exemptTotal.toFixed(2)}</strong></span>
            )}
            {flaggedItems.length > 0 && (
              <span className="text-amber-700">לבדיקה: <strong>₪{summary.flagTotal.toFixed(2)}</strong> ({flaggedItems.length} פריטים)</span>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-4">
        {/* Left Panel */}
        <div className="w-full md:w-64 shrink-0 space-y-3">
          {/* Upload Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
            } ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-xs text-slate-500">מעבד...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">העלה קבלה</p>
                <p className="text-xs text-slate-400">גרור לכאן או לחץ</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Receipt Thumbnails */}
          {sessionReceipts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">קבלות בסשן</p>
              {sessionReceipts.map((r, i) => (
                <div key={r.id} className="bg-white rounded-lg border border-slate-200 p-2 flex items-center gap-2">
                  <div className="w-10 h-10 bg-slate-100 rounded overflow-hidden shrink-0">
                    <img src={r.file_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{r.extracted?.store_name || `קבלה ${i + 1}`}</p>
                    <p className="text-xs text-slate-400">{r.items.length} פריטים</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Agent Panel */}
          <AgentPanel messages={agentMessages} />
        </div>

        {/* Main Table */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <SessionItemsTable items={allItems} onUpdateItem={handleVATUpdate} />
        </div>
      </div>
    </div>
  );
}
