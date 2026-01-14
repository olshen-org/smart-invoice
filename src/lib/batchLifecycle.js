import { addDays, differenceInHours, endOfMonth, format, startOfMonth } from "date-fns";
import { he } from "date-fns/locale";
import { api } from "./apiClient";

export const REMINDER_DELAY_HOURS = 48;
const STAGES = ["draft", "collecting", "waiting", "ready_to_close", "completed"];

const toDate = (value) => {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date?.getTime()) ? null : date;
};

const formatIso = (date) => (date ? date.toISOString() : null);

const baseStatsFromBatch = (batch) => {
  const total = Number(batch?.total_receipts) || 0;
  const approved = Number(batch?.processed_receipts) || 0;
  const pending = Math.max(total - approved, 0);

  return {
    total,
    approved,
    pending,
    rejected: Number(batch?.rejected_receipts) || 0,
    lastUpload: toDate(batch?.last_upload_at) || toDate(batch?.updated_date) || toDate(batch?.created_date),
  };
};

const statsFromReceipts = (receipts = []) => {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    return {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      lastUpload: null,
    };
  }

  const totals = receipts.reduce(
    (acc, receipt) => {
      acc.total += 1;
      if (receipt.status === "approved") acc.approved += 1;
      else if (receipt.status === "rejected") acc.rejected += 1;
      else acc.pending += 1;

      const created = toDate(receipt.created_date || receipt.updated_at || receipt.date);
      if (created && (!acc.lastUpload || created > acc.lastUpload)) {
        acc.lastUpload = created;
      }

      return acc;
    },
    { total: 0, approved: 0, pending: 0, rejected: 0, lastUpload: null }
  );

  return totals;
};

const computeStage = ({ storedStage, status, stats, lastUpload }) => {
  if (storedStage && STAGES.includes(storedStage)) {
    if (storedStage === "completed") return "completed";
  }

  if (status === "completed") return "completed";
  if (stats.total === 0) return "draft";
  if (stats.pending === 0 && stats.total > 0) return "ready_to_close";

  if (lastUpload) {
    const hoursSinceUpload = differenceInHours(new Date(), lastUpload);
    if (hoursSinceUpload >= REMINDER_DELAY_HOURS) {
      return "waiting";
    }
  }

  return "collecting";
};

const ensurePeriodMeta = (batch) => {
  if (batch?.period_start && batch?.period_end && batch?.period_label) {
    return {
      period_start: batch.period_start,
      period_end: batch.period_end,
      period_label: batch.period_label,
    };
  }
  return getDefaultPeriodMeta(batch?.created_date ? new Date(batch.created_date) : undefined);
};

export const getDefaultPeriodMeta = (referenceDate = new Date()) => {
  const start = startOfMonth(referenceDate);
  const end = endOfMonth(referenceDate);
  const periodLabel = `תקופת ${format(referenceDate, "MMMM yyyy", { locale: he })}`;

  return {
    period_start: formatIso(start),
    period_end: formatIso(end),
    period_label: periodLabel,
  };
};

export const enrichBatchLifecycle = (batch, receipts = null) => {
  if (!batch) return null;

  const stats = receipts ? statsFromReceipts(receipts) : baseStatsFromBatch(batch);
  const lastUpload = stats.lastUpload || toDate(batch?.last_upload_at);
  const derivedStage = computeStage({
    storedStage: batch.lifecycle_stage,
    status: batch.status,
    stats,
    lastUpload,
  });

  const periodMeta = ensurePeriodMeta(batch);
  const reminderDate = batch.next_reminder_at
    ? toDate(batch.next_reminder_at)
    : lastUpload
      ? addDays(lastUpload, REMINDER_DELAY_HOURS / 24)
      : null;

  // Calculate income/expense from receipts if available
  let incomeTotal = batch.income_total || 0;
  let expenseTotal = batch.expense_total || 0;
  
  if (receipts && Array.isArray(receipts)) {
    incomeTotal = receipts
      .filter(r => r.type === 'income' && r.status === 'approved')
      .reduce((sum, r) => sum + (r.total_amount || 0), 0);
    expenseTotal = receipts
      .filter(r => r.type !== 'income' && r.status === 'approved')
      .reduce((sum, r) => sum + (r.total_amount || 0), 0);
  }

  return {
    ...batch,
    ...periodMeta,
    lifecycle_stage: derivedStage,
    last_upload_at: batch.last_upload_at || formatIso(lastUpload),
    next_reminder_at: batch.next_reminder_at || formatIso(reminderDate),
    derived_stats: stats,
    income_total: incomeTotal,
    expense_total: expenseTotal,
    total_receipts: stats.total || batch.total_receipts || 0,
    processed_receipts: stats.approved || batch.processed_receipts || 0,
  };
};

export const lifecycleStageOrder = STAGES;

/** @param {string} batchId @param {{ currentStatus?: string }} [options] */
export const updateBatchLifecycleSnapshot = async (batchId, { currentStatus } = {}) => {
  if (!batchId) return null;

  const receipts = await api.entities.Receipt.filter({ batch_id: batchId });
  const stats = statsFromReceipts(receipts);
  
  // Calculate totals by type
  const incomeTotal = receipts
    .filter(r => r.type === 'income' && r.status === 'approved')
    .reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const expenseTotal = receipts
    .filter(r => r.type !== 'income' && r.status === 'approved')
    .reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const totalAmount = incomeTotal + expenseTotal;
  
  const lastUpload = stats.lastUpload;
  const reminder = lastUpload ? addDays(lastUpload, REMINDER_DELAY_HOURS / 24) : null;

  const status =
    currentStatus === "completed"
      ? "completed"
      : receipts.length === 0
        ? "open"
        : "processing";

  const lifecycleStage =
    status === "completed"
      ? "completed"
      : computeStage({
          storedStage: null,
          status,
          stats,
          lastUpload,
        });

  await api.entities.Batch.update(batchId, {
    total_receipts: stats.total,
    processed_receipts: stats.total - stats.pending,
    total_amount: totalAmount,
    income_total: incomeTotal,
    expense_total: expenseTotal,
    last_upload_at: formatIso(lastUpload),
    next_reminder_at: formatIso(reminder),
    lifecycle_stage: lifecycleStage,
    status,
  });

  return {
    total_amount: totalAmount,
    income_total: incomeTotal,
    expense_total: expenseTotal,
    stats,
    lifecycle_stage: lifecycleStage,
  };
};

