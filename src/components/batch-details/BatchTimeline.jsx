import React from "react";
import { Calendar, Upload, Clock, FileText } from "lucide-react";
import { lifecycleStageOrder } from "@/lib/batchLifecycle";

const STAGE_STEPS = [
  { key: "draft", title: "שלב 1 · יצירת תקופה", description: "הגדר תאריכים, לקוח והערות לפני תחילת העבודה.", icon: Calendar },
  { key: "collecting", title: "שלב 2 · העלאה ראשונה", description: "צלם או גרור קבלות כדי להתחיל עיבוד אוטומטי.", icon: Upload },
  { key: "waiting", title: "שלב 3 · המשך אחרי יומיים", description: "המתן 48 שעות וחזור כדי להשלים את האיסוף.", icon: Clock },
  { key: "ready_to_close", title: "שלב 4 · סגירה ודוח", description: "ודא שכל המסמכים אושרו וסגור את התקופה.", icon: FileText },
];

export default function BatchTimeline({ currentStage = "draft", lastUploadAt, nextReminderAt }) {
  const currentIndex = Math.max(lifecycleStageOrder.indexOf(currentStage), 0);
  const timelineIndex = Math.min(currentIndex, STAGE_STEPS.length - 1);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-slate-500">מסלול התקופה</p>
          <h3 className="text-xl font-bold text-slate-900">התקדמות בארבעה שלבים</h3>
        </div>
        <div className="text-sm text-slate-500 flex flex-col gap-1">
          {lastUploadAt && (
            <span>העלאה אחרונה: <strong className="text-slate-900">{lastUploadAt}</strong></span>
          )}
          {nextReminderAt && (
            <span>תזכורת הבאה: <strong className="text-slate-900">{nextReminderAt}</strong></span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {STAGE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = index < timelineIndex || currentStage === "completed";
          const isCurrent = index === timelineIndex && currentStage !== "completed";

          return (
            <div
              key={step.key}
              className={`rounded-2xl border p-4 transition-colors ${
                isCurrent
                  ? "border-blue-600 bg-blue-50/70"
                  : isCompleted
                    ? "border-green-500 bg-green-50/70"
                    : "border-slate-200 bg-slate-50/60"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                    isCurrent
                      ? "border-blue-500 text-blue-600 bg-white"
                      : isCompleted
                        ? "border-green-500 text-green-600 bg-white"
                        : "border-slate-200 text-slate-400 bg-white"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
              </div>
              <p className="text-xs text-slate-500 leading-snug">{step.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

