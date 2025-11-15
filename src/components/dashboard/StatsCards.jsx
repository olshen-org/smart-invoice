import React from 'react';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatsCards({ title, value, icon: Icon, bgColor }) {
  return (
    <Card className="relative overflow-hidden border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-300">
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${bgColor}`} />
      <CardHeader className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-500 mb-2">{title}</p>
            <CardTitle className="text-2xl md:text-3xl font-bold text-slate-900">
              {value}
            </CardTitle>
          </div>
          <div className={`p-3 rounded-2xl bg-gradient-to-br ${bgColor} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}