import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Printer, PieChart, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Separator } from "@/components/ui/separator";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Loader2 } from "lucide-react";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#FF6B6B'];

export default function BatchReport({ batch, receipts, onClose }) {
  const reportRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filter receipts
  const incomeReceipts = receipts.filter(r => r.type === 'income');
  const expenseReceipts = receipts.filter(r => r.type !== 'income');

  // Calculate Totals
  const totalIncome = incomeReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const totalExpense = expenseReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  
  const vatCollected = incomeReceipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0);
  const vatPaid = expenseReceipts.reduce((sum, r) => sum + (r.vat_amount || 0), 0);
  
  const netVat = vatCollected - vatPaid; // Positive = Pay to gov, Negative = Refund
  const profit = totalIncome - totalExpense;
  const estimatedTax = Math.max(0, profit * 0.23); // 23% corporate tax estimate example

  // Category Breakdown
  const expensesByCategory = expenseReceipts.reduce((acc, r) => {
    const cat = r.category || 'other';
    acc[cat] = (acc[cat] || 0) + (r.total_amount || 0);
    return acc;
  }, {});

  const chartData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`report-${batch.batch_name}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('שגיאה ביצירת הדוח');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-slate-900">דוח מסכם</h2>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 ml-2" />
                הדפס
            </Button>
            <Button onClick={handleDownloadPDF} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Download className="w-4 h-4 ml-2" />}
                הורד PDF
            </Button>
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-4xl mx-auto">
        <div className="text-center mb-8 border-b pb-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{batch.batch_name}</h1>
            <p className="text-slate-500">דוח הוצאות והכנסות תקופתי</p>
            {batch.customer_name && <p className="text-slate-500 font-medium mt-1">{batch.customer_name}</p>}
            <p className="text-sm text-slate-400 mt-2">הופק בתאריך: {new Date().toLocaleDateString('he-IL')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-green-50 border-green-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-800 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        סה״כ הכנסות
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-700">
                        ₪{totalIncome.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        סה״כ הוצאות
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-700">
                        ₪{totalExpense.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-100">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        רווח לפני מס
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        ₪{profit.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
                <h3 className="text-lg font-bold mb-4 border-r-4 border-blue-500 pr-3">סיכום מע״מ ומס</h3>
                <div className="space-y-4 bg-slate-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600">מע״מ עסקאות (לתשלום)</span>
                        <span className="font-bold text-slate-900">₪{vatCollected.toLocaleString('he-IL', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-600">מע״מ תשומות (לקיזוז)</span>
                        <span className="font-bold text-slate-900">₪{vatPaid.toLocaleString('he-IL', {minimumFractionDigits: 2})}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-lg">
                        <span className="font-bold text-slate-700">סה״כ מע״מ לתשלום</span>
                        <span className={`font-bold ${netVat >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₪{netVat.toLocaleString('he-IL', {minimumFractionDigits: 2})}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">* ערך חיובי = תשלום לרשויות, שלילי = החזר</p>
                    
                    <div className="mt-6 pt-4 border-t border-slate-200">
                         <div className="flex justify-between items-center">
                            <span className="text-slate-600">מס הכנסה משוער (23%)</span>
                            <span className="font-bold text-slate-900">₪{estimatedTax.toLocaleString('he-IL', {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold mb-4 border-r-4 border-purple-500 pr-3">התפלגות הוצאות</h3>
                <div className="h-[250px] w-full">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => `₪${value.toLocaleString()}`} />
                                <Legend />
                            </RePieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">
                            אין נתוני הוצאות
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div>
            <h3 className="text-lg font-bold mb-4 border-r-4 border-slate-500 pr-3">פירוט עסקאות</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                    <thead className="bg-slate-50 text-slate-600">
                        <tr>
                            <th className="p-3">תאריך</th>
                            <th className="p-3">סוג</th>
                            <th className="p-3">ספק/לקוח</th>
                            <th className="p-3">קטגוריה</th>
                            <th className="p-3">סכום</th>
                            <th className="p-3">מע״מ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {receipts.map((r, i) => (
                            <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                <td className="p-3">{new Date(r.date).toLocaleDateString('he-IL')}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded-full text-xs ${r.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {r.type === 'income' ? 'הכנסה' : 'הוצאה'}
                                    </span>
                                </td>
                                <td className="p-3 font-medium">{r.vendor_name}</td>
                                <td className="p-3 text-slate-500">{r.category}</td>
                                <td className="p-3 font-bold">₪{r.total_amount?.toLocaleString()}</td>
                                <td className="p-3 text-slate-500">₪{r.vat_amount?.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </div>
  );
}


