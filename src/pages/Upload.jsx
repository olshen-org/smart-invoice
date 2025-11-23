import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { useQuery } from "@tanstack/react-query";
import { useReceiptUpload } from "@/hooks/useReceiptUpload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, Loader2, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import UploadZone from "../components/upload/UploadZone";
import ReceiptPreview from "../components/upload/ReceiptPreview";

export default function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { uploadAndExtract, isProcessing, progress, error, setError } = useReceiptUpload();
  const [file, setFile] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [showNewBatchDialog, setShowNewBatchDialog] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");

  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => api.entities.Batch.list("-created_date"),
    initialData: [],
  });

  useEffect(() => {
    if (batches.length > 0 && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  const createBatchMutation = useMutation({
    mutationFn: (batchData) => api.entities.Batch.create(batchData),
    onSuccess: (newBatch) => {
      setSelectedBatchId(newBatch.id);
      setShowNewBatchDialog(false);
      setNewBatchName("");
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });

  const handleCreateNewBatch = () => {
    if (newBatchName.trim()) {
      createBatchMutation.mutate({ batch_name: newBatchName.trim() });
    }
  };

  const handleFileSelected = async (selectedFile) => {
    if (!selectedBatchId) {
      setError("נא לבחור אצווה לפני העלאת קבלה");
      return;
    }
    setFile(selectedFile);
    setExtractedData(null);

    try {
      const result = await uploadAndExtract(selectedFile);
      setExtractedData(result);
    } catch (err) {
      // Error already handled by the hook
    }
  };

  const handleSave = async (finalData) => {
    setIsProcessing(true);
    try {
      await api.entities.Receipt.create({
        ...finalData,
        batch_id: selectedBatchId
      });
      navigate(createPageUrl("BatchDetails") + `?id=${selectedBatchId}`);
    } catch (err) {
      setError("שגיאה בשמירת הקבלה. אנא נסה שוב.");
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setExtractedData(null);
    setError(null);
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="rounded-xl"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900">העלאת קבלה</h1>
              <p className="text-slate-500 mt-1">צלם או העלה קבלה לעיבוד אוטומטי</p>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!extractedData ? (
            <div className="space-y-6">
              <Card className="border-none shadow-lg shadow-blue-50">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <Label>בחר אצווה</Label>
                    <Select 
                      value={selectedBatchId} 
                      onValueChange={(value) => {
                        if (value === "new") {
                          setShowNewBatchDialog(true);
                        } else {
                          setSelectedBatchId(value);
                        }
                      }}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="w-full md:w-1/2 text-right" dir="rtl">
                        <SelectValue placeholder="בחר אצווה..." />
                      </SelectTrigger>
                      <SelectContent dir="rtl">
                        <SelectItem value="new" className="text-blue-600 font-semibold">
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            <span>צור אצווה חדשה</span>
                          </div>
                        </SelectItem>
                        {batches.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.batch_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {batches.length === 0 && !batchesLoading && (
                       <p className="text-sm text-slate-500">אין אצוות קיימות. צור אצווה חדשה להתחלה.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-2xl shadow-blue-100/50">
                <CardHeader>
                  <CardTitle className="text-xl font-bold">העלאת מסמך</CardTitle>
                </CardHeader>
                <CardContent>
                  <UploadZone
                    onFileSelected={handleFileSelected}
                    isProcessing={isProcessing}
                    progress={progress}
                  />
                </CardContent>
              </Card>
            </div>
          ) : (
            <ReceiptPreview
              extractedData={extractedData}
              fileUrl={extractedData?.receipt_image_url}
              onSave={handleSave}
              onCancel={handleCancel}
              isProcessing={isProcessing}
            />
          )}
        </div>
      </div>

      <Dialog open={showNewBatchDialog} onOpenChange={setShowNewBatchDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>צור אצווה חדשה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>שם האצווה</Label>
              <Input
                value={newBatchName}
                onChange={(e) => setNewBatchName(e.target.value)}
                placeholder="הזן שם אצווה..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newBatchName.trim()) {
                    handleCreateNewBatch();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowNewBatchDialog(false);
                setNewBatchName("");
              }}
              disabled={createBatchMutation.isPending}
            >
              ביטול
            </Button>
            <Button 
              onClick={handleCreateNewBatch}
              disabled={!newBatchName.trim() || createBatchMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createBatchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              צור אצווה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}