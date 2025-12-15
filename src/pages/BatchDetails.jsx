import { useState, useRef, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Plus, Loader2, BarChart3, BellRing, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { useReceiptUpload } from "@/lib/useReceiptUpload";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import BatchTimeline from "../components/batch-details/BatchTimeline";
import ActivityTimeline from "../components/batch-details/ActivityTimeline";
import { format, formatDistanceToNow, addMonths } from "date-fns";
import { he } from "date-fns/locale";

import BatchHeader from "../components/batch-details/BatchHeader";
import UploadSection from "../components/batch-details/UploadSection";
import ReceiptsGrid from "../components/batch-details/ReceiptsGrid";
import ReceiptReviewModal from "../components/batch-details/ReceiptReviewModal";
import BatchReport from "../components/batch-details/BatchReport";
import { enrichBatchLifecycle, updateBatchLifecycleSnapshot, getDefaultPeriodMeta } from "@/lib/batchLifecycle";
import CreateBatchDialog from "@/components/batches/CreateBatchDialog";

export default function BatchDetailsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const batchId = urlParams.get('id');
  
  // Mobile upload refs
  const fileInputRef = useRef(null);
  const { uploadAndExtract, isProcessing: isUploading } = useReceiptUpload();

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showReport, setShowReport] = useState(false);
  const [showNextBatchDialog, setShowNextBatchDialog] = useState(false);

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const results = await api.entities.Batch.filter({ id: batchId });
      return results[0];
    },
    enabled: !!batchId,
  });

  const { data: receipts, isLoading: receiptsLoading } = useQuery({
    queryKey: ['batch-receipts', batchId],
    queryFn: () => api.entities.Receipt.filter({ batch_id: batchId }, "-created_date"),
    initialData: [],
    enabled: !!batchId,
  });

  const enrichedBatch = useMemo(() => {
    if (!batch) return null;
    return enrichBatchLifecycle(batch, receipts);
  }, [batch, receipts]);

  // Calculate totals
  const incomeReceipts = receipts.filter(r => r.type === 'income');
  const expenseReceipts = receipts.filter(r => r.type !== 'income'); // Default to expense
  
  const incomeTotal = incomeReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const expenseTotal = expenseReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  const updateBatchMutation = useMutation({
    /** @param {{ id: string, data: object }} params */
    mutationFn: (params) => api.entities.Batch.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });

  const updateReceiptMutation = useMutation({
    /** @param {{ id: string, data: object }} params */
    mutationFn: (params) => api.entities.Receipt.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
      setSelectedReceipt(null);
      updateBatchStats();
      toast.success("הקבלה עודכנה בהצלחה");
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: (receiptData) => api.entities.Receipt.create(receiptData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
      setSelectedReceipt(null);
      updateBatchStats();
      toast.success("קבלה חדשה נוצרה");
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: (receiptId) => api.entities.Receipt.delete(receiptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
      updateBatchStats();
      toast.success("הקבלה נמחקה");
    },
  });

  const createNextBatchMutation = useMutation({
    mutationFn: (payload) => api.entities.Batch.create(payload),
    onSuccess: (newBatch) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowNextBatchDialog(false);
      navigate(createPageUrl("BatchDetails") + `?id=${newBatch.id}`);
    },
  });

  const updateBatchStats = async () => {
    await updateBatchLifecycleSnapshot(batchId, { currentStatus: batch?.status });
    queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
  };

  const handleFinalizeBatch = async () => {
    setShowReport(true);
  };

  const confirmCloseBatch = () => {
    if (!confirm("האם אתה בטוח שברצונך לסגור את הכרטיס סופית?")) return;

    updateBatchMutation.mutate({
      id: batchId,
      data: {
        status: 'completed',
        lifecycle_stage: 'completed',
        finalized_date: new Date().toISOString().split('T')[0]
      }
    });
    setShowReport(false);
    toast.success("הכרטיס נסגר בהצלחה");
    navigate(createPageUrl("Batches"));
  };

  const handleApproveReceipt = (receiptData) => {
    if (selectedReceipt?.id) {
      updateReceiptMutation.mutate({
        id: selectedReceipt.id,
        data: { ...receiptData, status: 'approved' }
      });
    } else {
      createReceiptMutation.mutate({
        ...receiptData,
        batch_id: batchId,
        status: 'approved'
      });
    }
  };

  const handleRejectReceipt = () => {
    if (selectedReceipt?.id) {
      updateReceiptMutation.mutate({
        id: selectedReceipt.id,
        data: { status: 'rejected' }
      });
    } else {
      setSelectedReceipt(null);
    }
  };

  const handleDeleteReceipt = (receiptId) => {
    deleteReceiptMutation.mutate(receiptId);
  };

  const handleToggleSelect = (receiptId) => {
    setSelectedIds(prev => 
      prev.includes(receiptId) 
        ? prev.filter(id => id !== receiptId)
        : [...prev, receiptId]
    );
  };

  const handleToggleSelectAll = (receiptsToSelect) => {
    const allIds = receiptsToSelect.map(r => r.id);
    const allSelected = allIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  const handleBulkApprove = async () => {
    if (!confirm(`האם לאשר ${selectedIds.length} קבלות?`)) return;
    
    for (const id of selectedIds) {
      await api.entities.Receipt.update(id, { status: 'approved' });
    }
    setSelectedIds([]);
    queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
    updateBatchStats();
    toast.success("הקבלות אושרו בהצלחה");
  };

  const handleBulkReject = async () => {
    if (!confirm(`האם לדחות ${selectedIds.length} קבלות?`)) return;
    
    for (const id of selectedIds) {
      await api.entities.Receipt.update(id, { status: 'rejected' });
    }
    setSelectedIds([]);
    queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
    updateBatchStats();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`האם למחוק ${selectedIds.length} קבלות? פעולה זו לא ניתנת לביטול.`)) return;
    
    for (const id of selectedIds) {
      await api.entities.Receipt.delete(id);
    }
    setSelectedIds([]);
    queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
    updateBatchStats();
    toast.success("הקבלות נמחקו");
  };

  const handleMobileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      toast.info("מעבד קבלה...", { duration: 4000 });
      const result = await uploadAndExtract(file);
      
      // Auto-open review modal with new data
      setSelectedReceipt({
        ...result,
        batch_id: batchId,
        status: 'pending',
        type: 'expense' // Default to expense
      });
      
    } catch (_error) {
      toast.error("שגיאה בעיבוד הקבלה");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateNextBatch = (data) => {
    createNextBatchMutation.mutate({
      ...data,
      lifecycle_stage: 'draft',
      status: 'open',
      last_upload_at: null,
      next_reminder_at: null,
    });
  };

  const batchForStage = enrichedBatch || batch;
  const pendingReceipts = receipts.filter(r => r.status === 'pending');
  const approvedReceipts = receipts.filter(r => r.status === 'approved');
  const rejectedReceipts = receipts.filter(r => r.status === 'rejected');
  const isCompleted = batchForStage?.lifecycle_stage === 'completed' || batchForStage?.status === 'completed';
  const nextReminderDate = batchForStage?.next_reminder_at ? new Date(batchForStage.next_reminder_at) : null;
  const lastUploadDate = batchForStage?.last_upload_at ? new Date(batchForStage.last_upload_at) : null;
  const reminderCountdown = nextReminderDate
    ? formatDistanceToNow(nextReminderDate, { addSuffix: true, locale: he })
    : null;
  const reminderOverdue = nextReminderDate ? nextReminderDate.getTime() < Date.now() : false;
  const formattedLastUpload = lastUploadDate ? format(lastUploadDate, "d MMM yyyy", { locale: he }) : null;
  const formattedNextReminder = nextReminderDate ? format(nextReminderDate, "d MMM yyyy", { locale: he }) : null;
  const allReceiptsHandled = pendingReceipts.length === 0 && receipts.length > 0;
  const readyForReport = batchForStage?.lifecycle_stage === 'ready_to_close' || isCompleted;
  const checklistItems = [
    {
      label: "כל הקבלות נבדקו",
      description: "אשר שכל הקבלות הוזנו וקיבלו סטטוס.",
      done: allReceiptsHandled,
    },
    {
      label: "תזכורת האיסוף מולאה",
      description: "חלפו 48 שעות מההעלאה האחרונה ונאספו כל המסמכים.",
      done: reminderOverdue || readyForReport,
    },
    {
      label: "דוח מס נוצר",
      description: "הפקת דוח וסגירת התקופה.",
      done: isCompleted,
    },
  ];
  const nextPeriodMeta = useMemo(() => {
    if (batchForStage?.period_end) {
      return getDefaultPeriodMeta(addMonths(new Date(batchForStage.period_end), 1));
    }
    return getDefaultPeriodMeta();
  }, [batchForStage?.period_end]);

  if (!batchId) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">לא נמצא מזהה כרטיס</p>
      </div>
    );
  }

  if (batchLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">טוען...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 min-h-screen pb-24 md:pb-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl("Batches"))}
                className="rounded-full hover:bg-slate-100"
              >
                <ArrowRight className="w-6 h-6 text-slate-600" />
              </Button>
              {!isCompleted && receipts.length > 0 && (
                <Button
                  onClick={handleFinalizeBatch}
                  className="bg-slate-900 text-white hover:bg-slate-800 mr-auto md:hidden rounded-full px-4 shadow-sm"
                  size="sm"
                >
                  <BarChart3 className="w-4 h-4 ml-2" />
                  דוח וסגירה
                </Button>
              )}
          </div>
          <div className="flex-1 w-full">
            <BatchHeader 
              batch={batchForStage}
                incomeTotal={incomeTotal}
                expenseTotal={expenseTotal}
            />
          </div>
          {!isCompleted && receipts.length > 0 && (
            <Button
              onClick={handleFinalizeBatch}
              className="bg-slate-900 text-white hover:bg-slate-800 hidden md:flex rounded-xl shadow-sm px-6"
            >
              <BarChart3 className="w-4 h-4 ml-2" />
              דוח וסגירה
            </Button>
          )}
        </div>

        <BatchTimeline
          currentStage={batchForStage?.lifecycle_stage}
          lastUploadAt={formattedLastUpload}
          nextReminderAt={formattedNextReminder}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm text-blue-600 font-semibold">שלב 2 · העלאה ראשונה</p>
                  <h3 className="text-xl font-bold text-slate-900">איסוף וקבלה</h3>
                  <p className="text-sm text-slate-500">
                    העלה מסמך חדש או סרוק קבלה כדי למלא את התקופה.
                  </p>
                </div>
                {selectedIds.length > 0 && (
                  <div className="text-sm text-slate-600 bg-blue-50 text-blue-700 px-3 py-2 rounded-full">
                    {selectedIds.length} קבלות נבחרו
                  </div>
                )}
              </div>
        <div className="hidden md:block">
            <UploadSection 
            batchId={batchId}
            onReceiptProcessed={setSelectedReceipt}
            selectedCount={selectedIds.length}
            onApproveAll={handleBulkApprove}
            onRejectAll={handleBulkReject}
            onDeleteAll={handleBulkDelete}
            />
        </div>
              <div className="md:hidden text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
                השתמש בכפתור הפלוס בטלפון כדי לצלם ולהעלות קבלה במהירות.
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">לוח קבלות</p>
                  <h3 className="text-xl font-bold text-slate-900">הסטטוס של כל המסמכים</h3>
                </div>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                  סה״כ {receipts.length}
                </Badge>
              </div>

        {receipts.length > 0 ? (
                <div className="space-y-6">
            {pendingReceipts.length > 0 && (
                    <div className="bg-yellow-50/70 rounded-xl border border-yellow-100 p-4">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <h2 className="text-lg font-bold text-slate-900">ממתין לאישור</h2>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                    {pendingReceipts.length}
                  </Badge>
                </div>
                <ReceiptsGrid 
                  receipts={pendingReceipts}
                  onSelectReceipt={setSelectedReceipt}
                  onDeleteReceipt={handleDeleteReceipt}
                  showStatus={false}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={() => handleToggleSelectAll(pendingReceipts)}
                />
              </div>
            )}

            {approvedReceipts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <h2 className="text-lg font-bold text-slate-900">אושרו</h2>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {approvedReceipts.length}
                  </Badge>
                </div>
                <ReceiptsGrid 
                  receipts={approvedReceipts}
                  onSelectReceipt={setSelectedReceipt}
                  onDeleteReceipt={handleDeleteReceipt}
                  showStatus={true}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={() => handleToggleSelectAll(approvedReceipts)}
                />
              </div>
            )}

            {rejectedReceipts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <h2 className="text-lg font-bold text-slate-900">נדחו</h2>
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    {rejectedReceipts.length}
                  </Badge>
                </div>
                <ReceiptsGrid 
                  receipts={rejectedReceipts}
                  onSelectReceipt={setSelectedReceipt}
                  onDeleteReceipt={handleDeleteReceipt}
                  showStatus={true}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onToggleSelectAll={() => handleToggleSelectAll(rejectedReceipts)}
                />
              </div>
            )}
          </div>
        ) : !receiptsLoading && (
                <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">העלה את הקבלה הראשונה</h3>
                  <p className="text-slate-500 max-w-xs mx-auto">
                    גרור קובץ לכאן או השתמש בכפתור הפלוס כדי להתחיל
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div
              className={`rounded-2xl p-5 border ${
                reminderOverdue
                  ? "bg-orange-50 border-orange-200"
                  : "bg-slate-900 text-white border-slate-800"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reminderOverdue ? "bg-orange-100 text-orange-700" : "bg-white/10"}`}>
                  <BellRing className={`w-5 h-5 ${reminderOverdue ? "" : "text-white"}`} />
                </div>
                <div>
                  <p className="text-sm opacity-80">שלב 3 · תזכורת</p>
                  <h3 className="text-lg font-semibold">{reminderOverdue ? "הגיע הזמן להעלות שוב" : "נעדכן אותך בהמשך"}</h3>
                </div>
              </div>
              <p className={`text-sm ${reminderOverdue ? "text-orange-800" : "text-white/80"}`}>
                {reminderCountdown
                  ? `תזכורת ${reminderCountdown}`
                  : "לא נוספו עדיין קבלות — לאחר ההעלאה הראשונה תוצג כאן תזכורת אוטומטית."}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ListChecks className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">שלב 4 · סגירה</p>
                  <h3 className="text-lg font-semibold text-slate-900">צ׳ק ליסט דוח</h3>
                </div>
              </div>
              <div className="space-y-3">
                {checklistItems.map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border ${
                        item.done ? "bg-green-500 border-green-500" : "border-slate-300"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              {!isCompleted && (
                <div className="space-y-2 w-full">
                  <Button
                    disabled={!readyForReport}
                    onClick={handleFinalizeBatch}
                    className="w-full rounded-xl"
                  >
                    {readyForReport ? "פתח דוח לסגירה" : "סיים לאסוף כדי לסגור"}
                  </Button>
                  {!readyForReport && (
                    <p className="text-xs text-slate-500 text-center">
                      הדוח ייפתח לאחר שכל הקבלות יקבלו סטטוס.
                    </p>
                  )}
                </div>
              )}
              {isCompleted && (
                <div className="space-y-3">
                  <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl p-3">
                    התקופה נסגרה בהצלחה. ניתן להפיק מחדש את הדוח בכל עת.
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => setShowReport(true)}>
                      הורד דוח
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => setShowNextBatchDialog(true)}
                    >
                      פתח תקופה חדשה
                    </Button>
                  </div>
          </div>
        )}
            </div>

            <ActivityTimeline batch={batchForStage} />
          </div>
        </div>

        {selectedReceipt && (
          <ReceiptReviewModal
            receipt={selectedReceipt}
            onApprove={handleApproveReceipt}
            onReject={handleRejectReceipt}
            onClose={() => setSelectedReceipt(null)}
            isProcessing={updateReceiptMutation.isPending || createReceiptMutation.isPending}
          />
        )}

        {/* Report Modal */}
        <Dialog open={showReport} onOpenChange={setShowReport}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                     <Button variant="outline" onClick={() => setShowReport(false)}>חזור לעריכה</Button>
                     <div className="flex gap-3">
                       {isCompleted && (
                         <Button
                           className="bg-blue-600 hover:bg-blue-700 text-white"
                           onClick={() => {
                             setShowReport(false);
                             setShowNextBatchDialog(true);
                           }}
                         >
                           פתח תקופה חדשה
                         </Button>
                       )}
                     {!isCompleted && (
                        <Button 
                            variant="destructive" 
                            onClick={confirmCloseBatch}
                            className="bg-slate-900 hover:bg-slate-800 text-white"
                        >
                            סגור כרטיס סופית
                        </Button>
                     )}
                </div>
                </div>
                <BatchReport batch={batchForStage || batch} receipts={receipts} onClose={() => setShowReport(false)} />
            </DialogContent>
        </Dialog>
      </div>

      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-20 right-6 z-50 md:hidden">
        <input 
            type="file" 
            accept="image/*,.pdf" 
            capture="environment"
            className="hidden" 
            ref={fileInputRef}
            onChange={handleMobileUpload}
        />
        <Button 
            size="icon" 
            className="w-16 h-16 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 text-white transition-transform hover:scale-105 active:scale-95 shadow-blue-300"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
        >
            {isUploading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
                <Plus className="w-8 h-8" />
            )}
        </Button>
      </div>
      <CreateBatchDialog
        open={showNextBatchDialog}
        onClose={() => setShowNextBatchDialog(false)}
        onSubmit={handleCreateNextBatch}
        isLoading={createNextBatchMutation.isPending}
        initialMeta={nextPeriodMeta}
      />
    </div>
  );
}