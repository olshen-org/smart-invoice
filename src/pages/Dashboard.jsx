import React, { useState } from "react";
import { api } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, TrendingUp, Receipt, CreditCard, Calendar } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

import StatsCards from "../components/dashboard/StatsCards";
import ReceiptsList from "../components/dashboard/ReceiptsList";
import ReceiptDetailsModal from "../components/dashboard/ReceiptDetailsModal";

export default function Dashboard() {
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['receipts'],
    queryFn: () => api.entities.Receipt.list("-created_date"),
    initialData: [],
  });

  const { data: batches } = useQuery({
    queryKey: ['batches'],
    queryFn: () => api.entities.Batch.list(),
    initialData: [],
  });

  const totalAmount = receipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const totalVAT = receipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0);
  
  const thisMonth = receipts.filter(r => {
    const receiptDate = new Date(r.date);
    const now = new Date();
    return receiptDate.getMonth() === now.getMonth() && 
           receiptDate.getFullYear() === now.getFullYear();
  });
  
  const thisMonthTotal = thisMonth.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">דשבורד קבלות</h1>
            <p className="text-slate-500">מעקב וניהול כל הקבלות שלך במקום אחד</p>
          </div>
          <Link to={createPageUrl("Upload")}>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-200 text-white px-6 py-6 text-base">
              <Plus className="w-5 h-5 ml-2" />
              קבלה חדשה
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCards 
            title="סה״כ קבלות" 
            value={receipts.length}
            icon={Receipt}
            bgColor="from-blue-500 to-blue-600"
          />
          <StatsCards 
            title="סה״כ סכום" 
            value={`₪${totalAmount.toLocaleString('he-IL', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
            icon={TrendingUp}
            bgColor="from-emerald-500 to-emerald-600"
          />
          <StatsCards 
            title='סה״כ מע"ם' 
            value={`₪${totalVAT.toLocaleString('he-IL', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
            icon={CreditCard}
            bgColor="from-purple-500 to-purple-600"
          />
          <StatsCards 
            title="החודש" 
            value={`₪${thisMonthTotal.toLocaleString('he-IL', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
            icon={Calendar}
            bgColor="from-orange-500 to-orange-600"
          />
        </div>

        <ReceiptsList 
          receipts={receipts}
          batches={batches}
          isLoading={isLoading}
          onSelectReceipt={setSelectedReceipt}
        />

        {selectedReceipt && (
          <ReceiptDetailsModal 
            receipt={selectedReceipt}
            onClose={() => setSelectedReceipt(null)}
          />
        )}
      </div>
    </div>
  );
}