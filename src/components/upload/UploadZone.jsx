import React, { useRef, useState } from 'react';
import { Upload, FileImage, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export default function UploadZone({ onFileSelected, isProcessing, progress }) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
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
        {/* File picker input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Camera capture input for mobile */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileInput}
          className="hidden"
        />

        <div
          className={`relative border-2 border-dashed rounded-2xl p-6 md:p-12 transition-all duration-300 ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-slate-200"
          }`}
        >
          <div className="text-center max-w-md mx-auto">
            <div className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <FileImage className="w-10 h-10 md:w-12 md:h-12 text-white" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2 md:mb-3">העלאת קבלה</h3>
            <p className="text-slate-500 mb-4 md:mb-6 text-base md:text-lg hidden md:block">גרור ושחרר קבלה לכאן, או לחץ לבחירה</p>
            <p className="text-slate-500 mb-4 text-base md:hidden">צלם או בחר קבלה מהגלריה</p>

            {/* Mobile: Two buttons side by side */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => cameraInputRef.current?.click()}
                className="rounded-xl px-6 bg-green-600 hover:bg-green-700 text-white md:hidden"
              >
                <Camera className="w-5 h-5 ml-2" />
                צלם קבלה
              </Button>
              <Button
                size="lg"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl px-6 md:px-8 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Upload className="w-5 h-5 ml-2" />
                <span className="md:hidden">בחר מהגלריה</span>
                <span className="hidden md:inline">בחר קובץ מהמכשיר</span>
              </Button>
            </div>

            <p className="text-sm text-slate-400 mt-4 md:mt-6">
              תמיכה ב: JPG, PNG, PDF
            </p>
          </div>
        </div>
      </div>
  );
}