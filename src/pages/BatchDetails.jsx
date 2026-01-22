import { useState, useRef, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus, Loader2, BarChart3, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { useReceiptUpload } from "@/lib/useReceiptUpload";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { addMonths } from "date-fns";

import StickyTotalsBar from "../components/batch-details/StickyTotalsBar";
import UploadSection from "../components/batch-details/UploadSection";
import ReceiptCard from "../components/batch-details/ReceiptCard";
import ReceiptReviewModal from "../components/batch-details/ReceiptReviewModal";
import BatchReport from "../components/batch-details/BatchReport";
import { getDefaultPeriodMeta } from "@/lib/batchLifecycle";
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

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['batch-receipts', batchId],
    queryFn: () => api.entities.Receipt.filter({ batch_id: batchId }, "-created_date"),
    initialData: [],
    enabled: !!batchId,
  });

  const updateBatchMutation = useMutation({
    mutationFn: (params) => api.entities.Batch.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });

  const updateReceiptMutation = useMutation({
    mutationFn: (params) => api.entities.Receipt.update(params.id, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
      toast.success("הקבלה עודכנה בהצלחה");
    },
    onError: (error) => {
      console.error("Error updating receipt:", error);
      toast.error("שגיאה בעדכון הקבלה: " + error.message);
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: (receiptData) => api.entities.Receipt.create(receiptData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
      setSelectedReceipt(null);
      toast.success("קבלה נוספה בהצלחה");
    },
    onError: (error) => {
      console.error("Error creating receipt:", error);
      toast.error("שגיאה ביצירת הקבלה: " + error.message);
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: (receiptId) => api.entities.Receipt.delete(receiptId, batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
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

  const handleOpenReport = () => {
    setShowReport(true);
  };

  const confirmCloseBatch = () => {
    if (!confirm("האם אתה בטוח שברצונך לסגור את התקופה?")) return;

    updateBatchMutation.mutate({
      id: batchId,
      data: {
        status: 'completed',
        lifecycle_stage: 'completed',
        finalized_date: new Date().toISOString().split('T')[0]
      }
    });
    setShowReport(false);
    toast.success("התקופה נסגרה בהצלחה");
    navigate(createPageUrl("Batches"));
  };

  const handleApproveReceipt = (receiptData) => {
    const dataWithBatchId = { ...receiptData, batch_id: batchId, status: 'approved' };

    if (selectedReceipt?.id) {
      updateReceiptMutation.mutate({
        id: selectedReceipt.id,
        data: dataWithBatchId
      });
    } else {
      createReceiptMutation.mutate(dataWithBatchId);
    }
    setSelectedReceipt(null);
  };

  const handleRejectReceipt = () => {
    setSelectedReceipt(null);
  };

  const handleSaveReceipt = (receiptData) => {
    updateReceiptMutation.mutate({
      id: receiptData.id,
      data: { ...receiptData, batch_id: batchId }
    });
  };

  const handleDeleteReceipt = (receiptId) => {
    if (!confirm("האם למחוק את הקבלה?")) return;
    deleteReceiptMutation.mutate(receiptId);
  };

  const handleMobileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      toast.info("מעבד קבלה...", { duration: 4000 });
      const result = await uploadAndExtract(file);

      setSelectedReceipt({
        ...result,
        batch_id: batchId,
        status: 'pending',
        type: 'expense'
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

  const isCompleted = batch?.lifecycle_stage === 'completed' || batch?.status === 'completed';
  const nextPeriodMeta = useMemo(() => {
    if (batch?.period_end) {
      return getDefaultPeriodMeta(addMonths(new Date(batch.period_end), 1));
    }
    return getDefaultPeriodMeta();
  }, [batch?.period_end]);

  if (!batchId) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">לא נמצא מזהה תקופה</p>
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
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(createPageUrl("Batches"))}
                className="rounded-full"
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-slate-900">{batch?.batch_name || 'תקופה'}</h1>
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <Badge className="bg-green-100 text-green-700 text-xs">סגור</Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-700 text-xs">פתוח</Badge>
                  )}
                  <span className="text-xs text-slate-500">{receipts.length} קבלות</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleOpenReport}
              size="sm"
              className="rounded-xl gap-1"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">דוח</span>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-4 space-y-4">
          {/* Sticky Totals Bar */}
          <StickyTotalsBar receipts={receipts} />

          {/* Upload Section */}
          {!isCompleted && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <UploadSection
                batchId={batchId}
                onReceiptProcessed={setSelectedReceipt}
              />
            </div>
          )}

          {/* Receipts List */}
          <div className="space-y-3">
            {receipts.length > 0 ? (
              receipts.map((receipt) => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  onToggleExpand={() => setSelectedReceipt(receipt)}
                  onDelete={handleDeleteReceipt}
                />
              ))
            ) : !receiptsLoading && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">אין קבלות עדיין</h3>
                <p className="text-sm text-slate-500">
                  צלם או העלה קבלה כדי להתחיל
                </p>
              </div>
            )}
          </div>

          {/* Close Period Button */}
          {!isCompleted && receipts.length > 0 && (
            <div className="pt-4">
              <Button
                onClick={handleOpenReport}
                className="w-full h-12 rounded-xl text-base bg-slate-900 hover:bg-slate-800"
              >
                <BarChart3 className="w-5 h-5 ml-2" />
                סגור תקופה והפק דוח
              </Button>
            </div>
          )}

          {/* Completed State */}
          {isCompleted && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <p className="text-sm text-green-800">
                התקופה נסגרה בהצלחה. ניתן להוריד את הדוח או לפתוח תקופה חדשה.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleOpenReport}
                  className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800"
                >
                  הורד דוח
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowNextBatchDialog(true)}
                  className="flex-1 rounded-xl"
                >
                  תקופה חדשה
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Review Modal - For new uploads and viewing existing receipts */}
      {selectedReceipt && (
        <ReceiptReviewModal
          receipt={selectedReceipt}
          onApprove={handleApproveReceipt}
          onReject={handleRejectReceipt}
          onClose={() => setSelectedReceipt(null)}
          onSave={(data) => {
            handleSaveReceipt(data);
            setSelectedReceipt(null);
          }}
          onDelete={handleDeleteReceipt}
          isProcessing={updateReceiptMutation.isPending || createReceiptMutation.isPending}
        />
      )}

      {/* Report Modal */}
      <Dialog open={showReport} onOpenChange={setShowReport}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" onClick={() => setShowReport(false)}>חזור</Button>
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
                  onClick={confirmCloseBatch}
                  className="bg-slate-900 hover:bg-slate-800 text-white"
                >
                  סגור תקופה
                </Button>
              )}
            </div>
          </div>
          <BatchReport batch={batch} receipts={receipts} onClose={() => setShowReport(false)} />
        </DialogContent>
      </Dialog>

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
          className="w-16 h-16 rounded-full shadow-2xl bg-blue-600 hover:bg-blue-700 text-white transition-transform hover:scale-105 active:scale-95"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isCompleted}
        >
          {isUploading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Plus className="w-8 h-8" />
          )}
        </Button>
      </div>

      {/* Create Next Batch Dialog */}
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
