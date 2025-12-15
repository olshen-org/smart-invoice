import React, { useState } from "react";
import { api } from "@/lib/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import BatchCard from "../components/batches/BatchCard";
import CreateBatchDialog from "../components/batches/CreateBatchDialog";
import { enrichBatchLifecycle, getDefaultPeriodMeta } from "@/lib/batchLifecycle";

export default function BatchesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: batches, isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => api.entities.Batch.list("-created_date"),
    initialData: [],
  });

  const createBatchMutation = useMutation({
    mutationFn: (batchData) => api.entities.Batch.create(batchData),
    onSuccess: (newBatch) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setShowCreateDialog(false);
      navigate(createPageUrl("BatchDetails") + `?id=${newBatch.id}`);
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId) => {
      // Delete all receipts in this batch
      const receipts = await api.entities.Receipt.filter({ batch_id: batchId });
      await Promise.all(receipts.map(r => api.entities.Receipt.delete(r.id)));
      // Delete the batch
      await api.entities.Batch.delete(batchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
    },
  });

  const handleCreateBatch = (data) => {
    const defaultMeta = getDefaultPeriodMeta();
    createBatchMutation.mutate({
      ...defaultMeta,
      lifecycle_stage: 'draft',
      status: 'open',
      last_upload_at: null,
      next_reminder_at: null,
      ...data,
    });
  };

  const handleDeleteBatch = (batchId) => {
    if (confirm('האם אתה בטוח שברצונך למחוק את הכרטיס וכל הקבלות שבו?')) {
      deleteBatchMutation.mutate(batchId);
    }
  };

  const enhancedBatches = (batches || []).map((batch) => enrichBatchLifecycle(batch));
  const openBatches = enhancedBatches.filter(b => b.lifecycle_stage === 'draft' || b.status === 'open');
  const processingBatches = enhancedBatches.filter(b => ['collecting', 'waiting', 'ready_to_close'].includes(b.lifecycle_stage) && b.status !== 'completed');
  const completedBatches = enhancedBatches.filter(b => b.lifecycle_stage === 'completed' || b.status === 'completed');

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">כרטיסים</h1>
            <p className="text-slate-500">נהל כרטיסים של קבלות מלקוחות שונים</p>
          </div>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-200 text-white px-6 py-6 text-base"
          >
            <Plus className="w-5 h-5 ml-2" />
            כרטיס חדש
          </Button>
        </div>

        {/* Open Batches */}
        {openBatches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">כרטיסים פתוחים</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {openBatches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} onDelete={handleDeleteBatch} />
              ))}
            </div>
          </div>
        )}

        {/* Processing Batches */}
        {processingBatches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">בעיבוד</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {processingBatches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} onDelete={handleDeleteBatch} />
              ))}
            </div>
          </div>
        )}

        {/* Completed Batches */}
        {completedBatches.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">הושלמו</h2>
              <Badge className="bg-slate-900 text-white">
                ארכיון דוחות
              </Badge>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedBatches.map((batch) => (
                  <BatchCard key={batch.id} batch={batch} onDelete={handleDeleteBatch} />
                ))}
              </div>
            </div>
          </div>
        )}

        {batches.length === 0 && !isLoading && (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">אין כרטיסים עדיין</h3>
            <p className="text-slate-500 mb-6">צור כרטיס חדש כדי להתחיל להעלות קבלות</p>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Plus className="w-5 h-5 ml-2" />
              צור כרטיס ראשון
            </Button>
          </div>
        )}

        <CreateBatchDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSubmit={handleCreateBatch}
          isLoading={createBatchMutation.isPending}
        />
      </div>
    </div>
  );
}