import React, { useMemo, useState, useRef } from "react";
import { api } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Upload, FileText, ChevronLeft, Loader2, CheckCircle2, Clock, AlertCircle, FolderOpen, Receipt, Building2, Lock } from "lucide-react";
import CreateBatchDialog from "@/components/batches/CreateBatchDialog";
import { enrichBatchLifecycle, getDefaultPeriodMeta } from "@/lib/batchLifecycle";
import { useReceiptUpload } from "@/lib/useReceiptUpload";
import { toast } from "sonner";
import ReceiptReviewModal from "@/components/batch-details/ReceiptReviewModal";
import ReceiptDetailsModal from "@/components/dashboard/ReceiptDetailsModal";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Clear Hebrew status messages
const stageMessages = {
  draft: {
    title: "התקופה נפתחה",
    subtitle: "העלה את הקבלה הראשונה כדי להתחיל",
    color: "border-blue-200 bg-blue-50",
    textColor: "text-blue-700",
    icon: FolderOpen,
  },
  collecting: {
    title: "איסוף פעיל",
    subtitle: "ניתן להמשיך להעלות קבלות",
    color: "border-amber-200 bg-amber-50",
    textColor: "text-amber-700",
    icon: Upload,
  },
  waiting: {
    title: "ממתין להעלאות נוספות",
    subtitle: "עברו 48 שעות - סיים או המשך לאסוף",
    color: "border-orange-200 bg-orange-50",
    textColor: "text-orange-700",
    icon: Clock,
  },
  ready_to_close: {
    title: "מוכן להפקת דוח",
    subtitle: "כל הקבלות אושרו - ניתן לסגור",
    color: "border-green-200 bg-green-50",
    textColor: "text-green-700",
    icon: CheckCircle2,
  },
  completed: {
    title: "התקופה הסתיימה",
    subtitle: "הדוח הופק בהצלחה",
    color: "border-slate-200 bg-slate-50",
    textColor: "text-slate-600",
    icon: CheckCircle2,
  },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showNewPeriodConfirm, setShowNewPeriodConfirm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  const fileInputRef = useRef(null);
  const { uploadAndExtract, isProcessing: isUploading } = useReceiptUpload();

  // Fetch batches
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => api.entities.Batch.list("-created_date"),
  });

  // Find active batch and fetch its receipts for accurate totals
  const activeBatchRaw = batches.find((b) => b.status !== "completed" && b.lifecycle_stage !== "completed");
  
  const { data: activeReceipts = [] } = useQuery({
    queryKey: ['batch-receipts', activeBatchRaw?.id],
    queryFn: () => api.entities.Receipt.filter({ batch_id: activeBatchRaw.id }, "-created_date"),
    enabled: !!activeBatchRaw?.id,
  });

  // Enrich batch with real receipt data
  const activeBatch = useMemo(() => {
    if (!activeBatchRaw) return null;
    return enrichBatchLifecycle(activeBatchRaw, activeReceipts);
  }, [activeBatchRaw, activeReceipts]);

  const completedBatches = useMemo(() => {
    return batches
      .filter((b) => b.status === "completed" || b.lifecycle_stage === "completed")
      .slice(0, 3)
      .map((b) => enrichBatchLifecycle(b));
  }, [batches]);

  const createBatchMutation = useMutation({
    mutationFn: (payload) => api.entities.Batch.create(payload),
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowCreateDialog(false);
      navigate(createPageUrl("BatchDetails") + `?id=${batch.id}`);
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: (receiptData) => api.entities.Receipt.create(receiptData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', activeBatch?.id] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setSelectedReceipt(null);
      toast.success("קבלה נוספה בהצלחה");
    },
  });

  const handleCreateBatch = (data) => {
    createBatchMutation.mutate({
      ...getDefaultPeriodMeta(),
      lifecycle_stage: "draft",
      status: "open",
      last_upload_at: null,
      next_reminder_at: null,
      ...data,
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeBatch) return;

    try {
      toast.info("מעבד קבלה...", { duration: 4000 });
      const result = await uploadAndExtract(file);
      setSelectedReceipt({
        ...result,
        batch_id: activeBatch.id,
        status: 'pending',
        type: 'expense'
      });
    } catch (error) {
      toast.error("שגיאה בעיבוד הקבלה");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleApproveReceipt = (receiptData) => {
    createReceiptMutation.mutate({
      ...receiptData,
      batch_id: activeBatch.id,
      status: 'approved'
    });
  };

  if (batchesLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const stage = activeBatch?.lifecycle_stage || "draft";
  const stageInfo = stageMessages[stage] || stageMessages.draft;
  const StageIcon = stageInfo.icon;

  // Calculate totals
  const incomeTotal = activeBatch?.income_total || 0;
  const expenseTotal = activeBatch?.expense_total || 0;
  const receiptCount = activeBatch?.total_receipts || 0;
  const pendingCount = (activeBatch?.derived_stats?.pending) || 0;

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        
        {/* Active Batch Card */}
        {activeBatch ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* Compact Header with inline status */}
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-slate-900">{activeBatch.batch_name}</h1>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    stage === 'ready_to_close' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : stage === 'collecting' 
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    <StageIcon className="w-3 h-3" />
                    {stageInfo.title}
                  </span>
                </div>
                <button
                  onClick={() => navigate(createPageUrl("BatchDetails") + `?id=${activeBatch.id}`)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                >
                  פרטים
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats Row - Refined */}
            <div className="grid grid-cols-3 gap-px bg-slate-100/50 border-y border-slate-100">
              <div className="bg-white p-3 text-center">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{receiptCount}</p>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">קבלות</p>
              </div>
              <div className="bg-white p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600 tabular-nums">₪{incomeTotal.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">הכנסות</p>
              </div>
              <div className="bg-white p-3 text-center">
                <p className="text-2xl font-bold text-rose-600 tabular-nums">₪{expenseTotal.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">הוצאות</p>
              </div>
            </div>

            {/* Primary Actions - Same Row */}
            <div className="p-4 pt-3">
              <input 
                type="file" 
                accept="image/*,.pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <div className="flex gap-2">
                <Button 
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />
                      מעבד...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 ml-1.5" />
                      העלה קבלה
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline"
                  className="flex-1 h-10 rounded-lg text-sm font-medium border-slate-200 hover:bg-slate-50"
                  onClick={() => navigate(createPageUrl("BatchDetails") + `?id=${activeBatch.id}`)}
                  disabled={receiptCount === 0}
                >
                  <Lock className="w-3.5 h-3.5 ml-1.5" />
                  סגור
                </Button>
                
                <Button 
                  variant="outline"
                  className="h-10 px-3 rounded-lg text-sm font-medium border-slate-200 hover:bg-slate-50"
                  onClick={() => setShowNewPeriodConfirm(true)}
                  title="תקופה חדשה"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Recent Receipts Preview */}
            {receiptCount > 0 && (
              <div className="border-t border-slate-100">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                  <h3 className="text-sm font-semibold text-slate-700">קבלות אחרונות</h3>
                  <button
                    onClick={() => navigate(createPageUrl("BatchDetails") + `?id=${activeBatch.id}`)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  >
                    הצג הכל ({receiptCount})
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="divide-y divide-slate-50">
                  {activeReceipts.slice(0, 5).map((receipt) => (
                    <button
                      key={receipt.id}
                      onClick={() => setViewingReceipt(receipt)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors text-right"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        receipt.type === 'income' 
                          ? 'bg-emerald-100 text-emerald-600' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {receipt.type === 'income' ? (
                          <Receipt className="w-5 h-5" />
                        ) : (
                          <Building2 className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {receipt.vendor_name || 'ספק לא ידוע'}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-slate-500">
                            {receipt.date ? format(new Date(receipt.date), "d בMMM", { locale: he }) : '—'}
                          </p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            receipt.type === 'income' 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {receipt.type === 'income' ? 'הכנסה' : 'הוצאה'}
                          </span>
                        </div>
                      </div>
                      <div className="text-left">
                        <p className={`text-sm font-bold ${
                          receipt.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {receipt.type === 'income' ? '+' : ''}₪{(receipt.total_amount || 0).toLocaleString()}
                        </p>
                        {receipt.status === 'pending' && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                            ממתין
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                
                {pendingCount > 0 && (
                  <div className="px-4 py-3 bg-amber-50/50 border-t border-amber-100">
                    <button
                      onClick={() => navigate(createPageUrl("BatchDetails") + `?id=${activeBatch.id}`)}
                      className="w-full flex items-center justify-center gap-2 text-sm text-amber-700 hover:text-amber-800 font-medium"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {pendingCount} קבלות ממתינות לאישור
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* No Active Batch */
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">אין תקופה פתוחה</h2>
            <p className="text-sm text-slate-500 mb-4">
              צור תקופה חדשה כדי להתחיל לאסוף קבלות
            </p>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 ml-2" />
              צור תקופה
            </Button>
          </div>
        )}

        {/* Recent Batches */}
        {completedBatches.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-medium text-slate-600">תקופות קודמות</h3>
              <Link 
                to={createPageUrl("Batches")} 
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                הכל
              </Link>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {completedBatches.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => navigate(createPageUrl("BatchDetails") + `?id=${batch.id}`)}
                  className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors w-full text-right"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{batch.batch_name}</span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {batch.total_receipts || 0} קבלות
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Confirmation dialog for creating new period */}
      <AlertDialog open={showNewPeriodConfirm} onOpenChange={setShowNewPeriodConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>יצירת תקופה חדשה</AlertDialogTitle>
            <AlertDialogDescription>
              {activeBatch ? (
                <>
                  כרגע פתוחה התקופה <strong>"{activeBatch.batch_name}"</strong> עם {receiptCount} קבלות.
                  <br /><br />
                  האם לסגור אותה ולפתוח תקופה חדשה?
                </>
              ) : (
                "האם ליצור תקופה חדשה?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            {activeBatch && (
              <AlertDialogAction
                onClick={() => {
                  setShowNewPeriodConfirm(false);
                  navigate(createPageUrl("BatchDetails") + `?id=${activeBatch.id}`);
                }}
                className="bg-slate-600 hover:bg-slate-700"
              >
                סגור תקופה נוכחית
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={() => {
                setShowNewPeriodConfirm(false);
                setShowCreateDialog(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {activeBatch ? "פתח תקופה נוספת" : "צור תקופה"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateBatchDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateBatch}
        isLoading={createBatchMutation.isPending}
      />

      {selectedReceipt && (
        <ReceiptReviewModal
          receipt={selectedReceipt}
          onApprove={handleApproveReceipt}
          onReject={() => setSelectedReceipt(null)}
          onClose={() => setSelectedReceipt(null)}
          isProcessing={createReceiptMutation.isPending}
        />
      )}

      {viewingReceipt && (
        <ReceiptDetailsModal
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}
    </div>
  );
}
