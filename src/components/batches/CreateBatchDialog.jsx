import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function CreateBatchDialog({ open, onClose, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    batch_name: '',
    customer_name: '',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ batch_name: '', customer_name: '', notes: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">אצווה חדשה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch_name">שם האצווה *</Label>
              <Input
                id="batch_name"
                value={formData.batch_name}
                onChange={(e) => setFormData({...formData, batch_name: e.target.value})}
                placeholder="לדוגמה: קבלות ינואר 2024"
                required
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_name">שם הלקוח</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                placeholder="שם הלקוח (אופציונלי)"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="הערות נוספות..."
                className="rounded-xl"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl"
            >
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.batch_name}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl"
            >
              צור אצווה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}