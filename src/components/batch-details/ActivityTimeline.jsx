import React from "react";
import { Flag, Upload, Bell, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const formatDate = (value) => {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date?.getTime())) return null;
  return format(date, "d MMM yyyy · HH:mm", { locale: he });
};

export default function ActivityTimeline({ batch }) {
  if (!batch) return null;

  const events = [
    {
      label: "התקופה נוצרה",
      date: batch.created_date,
      icon: Flag,
    },
    {
      label: "העלאה אחרונה",
      date: batch.last_upload_at,
      icon: Upload,
    },
    {
      label: "תזכורת קרובה",
      date: batch.next_reminder_at,
      icon: Bell,
    },
  ];

  if (batch.finalized_date || batch.lifecycle_stage === "completed") {
    events.push({
      label: "התקופה נסגרה",
      date: batch.finalized_date || batch.updated_date,
      icon: CheckCircle2,
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-sm text-slate-500 mb-2">יומן פעילות</p>
      <h3 className="text-lg font-semibold text-slate-900 mb-4">מה קרה לאחרונה</h3>
      <div className="space-y-4">
        {events.map(({ label, date, icon: Icon }) => {
          const formatted = formatDate(date);
          if (!formatted) return null;

          return (
            <div key={`${label}-${formatted}`} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                <Icon className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{label}</p>
                <p className="text-xs text-slate-500">{formatted}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

