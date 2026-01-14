import { useState, useEffect } from "react";
import { api } from "@/lib/apiClient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, Loader2, FileText, ChevronLeft } from "lucide-react";
import CreateBatchDialog from "@/components/batches/CreateBatchDialog";
import { getDefaultPeriodMeta } from "@/lib/batchLifecycle";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch batches
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => api.entities.Batch.list("-created_date"),
  });

  // Find active (open) batch
  const activeBatch = batches.find(
    (b) => b.status !== "completed" && b.lifecycle_stage !== "completed"
  );

  // Completed batches for history
  const completedBatches = batches
    .filter((b) => b.status === "completed" || b.lifecycle_stage === "completed")
    .slice(0, 5);

  // Auto-redirect to active batch
  useEffect(() => {
    if (!batchesLoading && activeBatch) {
      navigate(createPageUrl("BatchDetails") + `?id=${activeBatch.id}`, { replace: true });
    }
  }, [batchesLoading, activeBatch, navigate]);

  const createBatchMutation = useMutation({
    mutationFn: (payload) => api.entities.Batch.create(payload),
    onSuccess: (batch) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowCreateDialog(false);
      navigate(createPageUrl("BatchDetails") + `?id=${batch.id}`);
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

  // Show loading while checking for active batch
  if (batchesLoading || activeBatch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // No active batch - show create prompt
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-md mx-auto space-y-6 pt-12">
        {/* Create New Period Card */}
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">אין תקופה פתוחה</h1>
          <p className="text-sm text-slate-500 mb-6">
            צור תקופה חדשה כדי להתחיל לאסוף קבלות
          </p>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 h-12 text-base"
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="w-5 h-5 ml-2" />
            צור תקופה חדשה
          </Button>
        </div>

        {/* Previous Periods */}
        {completedBatches.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-slate-600 px-1">תקופות קודמות</h2>
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {completedBatches.map((batch) => (
                <button
                  key={batch.id}
                  onClick={() => navigate(createPageUrl("BatchDetails") + `?id=${batch.id}`)}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors w-full text-right"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <span className="text-sm font-medium text-slate-900">{batch.batch_name}</span>
                      <p className="text-xs text-slate-500">{batch.total_receipts || 0} קבלות</p>
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <CreateBatchDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateBatch}
        isLoading={createBatchMutation.isPending}
      />
    </div>
  );
}
