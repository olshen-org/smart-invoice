import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDefaultPeriodMeta } from "@/lib/batchLifecycle";
import { addDays, format } from "date-fns";
import { he } from "date-fns/locale";
import { Calendar, Timer } from "lucide-react";

const toDateInput = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return format(date, "yyyy-MM-dd");
};

const toISODate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export default function CreateBatchDialog({ open, onClose, onSubmit, isLoading, initialMeta = null }) {
  const defaultMeta = useMemo(() => initialMeta || getDefaultPeriodMeta(), [initialMeta]);

  const [formData, setFormData] = useState({
    batch_name: defaultMeta.period_label,
    customer_name: '',
    notes: '',
    period_start: toDateInput(defaultMeta.period_start),
    period_end: toDateInput(defaultMeta.period_end),
    period_label: defaultMeta.period_label,
  });

  useEffect(() => {
    if (open) {
      const meta = initialMeta || getDefaultPeriodMeta();
      setFormData({
        batch_name: meta.period_label,
        customer_name: '',
        notes: '',
        period_start: toDateInput(meta.period_start),
        period_end: toDateInput(meta.period_end),
        period_label: meta.period_label,
      });
    }
  }, [open, initialMeta]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      period_start: toISODate(formData.period_start),
      period_end: toISODate(formData.period_end),
      period_label: formData.period_label || formData.batch_name,
    });
  };

  const periodSummary = (() => {
    const start = formData.period_start ? new Date(formData.period_start) : null;
    const end = formData.period_end ? new Date(formData.period_end) : null;
    const due = end ? addDays(end, 15) : null;

    return {
      startLabel: start ? format(start, "d MMMM yyyy", { locale: he }) : "לא נבחר",
      endLabel: end ? format(end, "d MMMM yyyy", { locale: he }) : "לא נבחר",
      dueLabel: due ? format(due, "d MMMM yyyy", { locale: he }) : "היקבע לאחר בחירת טווח",
    };
  })();

  const isInvalidRange =
    formData.period_start &&
    formData.period_end &&
    new Date(formData.period_start) > new Date(formData.period_end);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">תקופה חדשה</DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            הגדר את טווח התאריכים, הלקוח והתזכורות עבור התקופה הבאה.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <section className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">שלב 1 · פרטי תקופה</p>
            <div className="space-y-2">
              <Label htmlFor="batch_name">שם התקופה *</Label>
              <Input
                id="batch_name"
                value={formData.batch_name}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    batch_name: e.target.value,
                    period_label: e.target.value,
                  }))
                }
                placeholder="לדוגמה: תקופת ינואר 2026"
                required
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period_start">תאריך התחלה</Label>
                <Input
                  type="date"
                  id="period_start"
                  value={formData.period_start}
                  onChange={(e) => setFormData((prev) => ({ ...prev, period_start: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_end">תאריך סיום</Label>
                <Input
                  type="date"
                  id="period_end"
                  value={formData.period_end}
                  onChange={(e) => setFormData((prev) => ({ ...prev, period_end: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>
            {isInvalidRange && (
              <p className="text-xs text-red-500">תאריך הסיום חייב להיות מאוחר מתאריך ההתחלה.</p>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">שלב 2 · לקוח והערות</p>
            <div className="space-y-2">
              <Label htmlFor="customer_name">שם הלקוח</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="שם הלקוח (אופציונלי)"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="הנחיות למשרד, תזכורות או סיכום עבור הלקוח."
                className="rounded-xl"
                rows={3}
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">שלב 3 · מועדי תזכורת</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold mb-1">
                  <Calendar className="w-4 h-4" />
                  התחלה
                </div>
                <p className="text-slate-800 text-sm">{periodSummary.startLabel}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold mb-1">
                  <Calendar className="w-4 h-4" />
                  סיום
                </div>
                <p className="text-slate-800 text-sm">{periodSummary.endLabel}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                <div className="flex items-center gap-2 text-emerald-800 text-sm font-semibold mb-1">
                  <Timer className="w-4 h-4" />
                  תאריך יעד
                </div>
                <p className="text-slate-800 text-sm">{periodSummary.dueLabel}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              המערכת תזכיר לך להעלות מסמכים נוספים לאחר 48 שעות מהעלאה אחרונה.
            </p>
          </section>

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
              disabled={isLoading || !formData.batch_name || isInvalidRange}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl"
            >
              צור תקופה
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}