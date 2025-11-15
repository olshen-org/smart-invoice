import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, CheckCircle, XCircle, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";

import BatchHeader from "../components/batch-details/BatchHeader";
import UploadSection from "../components/batch-details/UploadSection";
import ReceiptsGrid from "../components/batch-details/ReceiptsGrid";
import ReceiptReviewModal from "../components/batch-details/ReceiptReviewModal";

export default function BatchDetailsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const batchId = urlParams.get('id');

  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const results = await base44.entities.Batch.filter({ id: batchId });
      return results[0];
    },
    enabled: !!batchId,
  });

  const { data: receipts, isLoading: receiptsLoading } = useQuery({
    queryKey: ['batch-receipts', batchId],
    queryFn: () => base44.entities.Receipt.filter({ batch_id: batchId }, "-created_date"),
    initialData: [],
    enabled: !!batchId,
  });

  const updateBatchMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Batch.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });

  const updateReceiptMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Receipt.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
      setSelectedReceipt(null);
      updateBatchStats();
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: (receiptData) => base44.entities.Receipt.create(receiptData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
      setSelectedReceipt(null);
      updateBatchStats();
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: (receiptId) => base44.entities.Receipt.delete(receiptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-receipts', batchId] });
      updateBatchStats();
    },
  });

  const updateBatchStats = async () => {
    const updatedReceipts = await base44.entities.Receipt.filter({ batch_id: batchId });
    const totalAmount = updatedReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const processedCount = updatedReceipts.filter(r => r.status === 'approved').length;
    
    updateBatchMutation.mutate({
      id: batchId,
      data: {
        total_receipts: updatedReceipts.length,
        processed_receipts: processedCount,
        total_amount: totalAmount,
        status: updatedReceipts.length > 0 && processedCount === updatedReceipts.length ? 'completed' : 
                updatedReceipts.length > 0 ? 'processing' : 'open'
      }
    });
  };

  const handleFinalizeBatch = async () => {
    updateBatchMutation.mutate({
      id: batchId,
      data: {
        status: 'completed',
        finalized_date: new Date().toISOString().split('T')[0]
      }
    });
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

  if (!batchId) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">לא נמצא מזהה אצווה</p>
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

  const pendingReceipts = receipts.filter(r => r.status === 'pending');
  const approvedReceipts = receipts.filter(r => r.status === 'approved');
  const isCompleted = batch?.status === 'completed';

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Batches"))}
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <BatchHeader batch={batch} />
          </div>
          {!isCompleted && receipts.length > 0 && (
            <Button
              onClick={handleFinalizeBatch}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 ml-2" />
              סגור אצווה
            </Button>
          )}
        </div>

        <UploadSection 
          batchId={batchId}
          onReceiptProcessed={setSelectedReceipt}
        />

        {receipts.length > 0 ? (
          <div className="space-y-6">
            {pendingReceipts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-bold text-slate-900">ממתין לאישור</h2>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    {pendingReceipts.length}
                  </Badge>
                </div>
                <ReceiptsGrid 
                  receipts={pendingReceipts}
                  onSelectReceipt={setSelectedReceipt}
                  onDeleteReceipt={handleDeleteReceipt}
                  showStatus={false}
                />
              </div>
            )}

            {approvedReceipts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
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
                />
              </div>
            )}
          </div>
        ) : !receiptsLoading && (
          <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
            <Upload className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">אין קבלות באצווה</h3>
            <p className="text-sm text-slate-500">התחל להעלות קבלות לאצווה זו</p>
          </div>
        )}

        {selectedReceipt && (
          <ReceiptReviewModal
            receipt={selectedReceipt}
            onApprove={handleApproveReceipt}
            onReject={handleRejectReceipt}
            onClose={() => setSelectedReceipt(null)}
            isProcessing={updateReceiptMutation.isPending || createReceiptMutation.isPending}
          />
        )}
      </div>
    </div>
  );
}