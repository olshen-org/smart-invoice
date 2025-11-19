import React, { useRef, useState } from 'react';
import { Upload, FileImage, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function UploadZone({ onFileSelected, isProcessing, progress }) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      onFileSelected(droppedFiles[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  if (isProcessing) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">מעבד את הקבלה...</h3>
        <p className="text-slate-500 mb-6">זה ייקח רק כמה שניות</p>
        <Progress value={progress} className="w-64 mx-auto" />
        <p className="text-sm text-slate-500 mt-2">{progress}%</p>
      </div>
    );
  }

  return (
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className="space-y-6"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileInput}
          className="hidden"
        />

        <div
          className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-slate-200"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-center max-w-md mx-auto">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <FileImage className="w-12 h-12 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">העלאת קובץ</h3>
            <p className="text-slate-500 mb-6 text-lg">גרור ושחרר קבלה לכאן, או לחץ לבחירה</p>
            <Button size="lg" className="rounded-xl px-8 bg-blue-600 hover:bg-blue-700 text-white">
              <Upload className="w-5 h-5 ml-2" />
              בחר קובץ מהמכשיר
            </Button>
            <p className="text-sm text-slate-400 mt-6">
              תמיכה ב: JPG, PNG, PDF
            </p>
          </div>
        </div>
      </div>
  );
}