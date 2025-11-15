import React, { useRef, useState, useEffect } from 'react';
import { Upload, Camera, FileImage, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function UploadZone({ onFileSelected, isProcessing, progress }) {
  const fileInputRef = useRef(null);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isMobile] = useState(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: isMobile ? 'environment' : 'user' },
        audio: false 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraReady(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraReady(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !isCameraReady) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onFileSelected(file);
      setShowCameraDialog(false);
    }, 'image/jpeg', 0.95);
  };

  useEffect(() => {
    if (showCameraDialog) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showCameraDialog]);

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
    <>
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

        <div className="grid md:grid-cols-2 gap-6">
          <div
            className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 ${
              dragActive ? "border-blue-500 bg-blue-50" : "border-slate-200"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                <FileImage className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">העלאת קובץ</h3>
              <p className="text-slate-500 mb-4">גרור ושחרר או לחץ לבחירה</p>
              <Button variant="outline" className="rounded-xl">
                <Upload className="w-4 h-4 ml-2" />
                בחר קובץ
              </Button>
              <p className="text-xs text-slate-400 mt-4">
                תמיכה ב: JPG, PNG, PDF
              </p>
            </div>
          </div>

          <div
            className="border-2 border-dashed border-slate-200 rounded-2xl p-8 hover:border-purple-400 hover:bg-purple-50/50 transition-all duration-300 cursor-pointer"
            onClick={() => setShowCameraDialog(true)}
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200">
                {isMobile ? (
                  <Smartphone className="w-10 h-10 text-white" />
                ) : (
                  <Camera className="w-10 h-10 text-white" />
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {isMobile ? 'צילום במצלמה' : 'שימוש במצלמת רשת'}
              </h3>
              <p className="text-slate-500 mb-4">צלם את הקבלה ישירות</p>
              <Button variant="outline" className="rounded-xl">
                <Camera className="w-4 h-4 ml-2" />
                פתח מצלמה
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Camera className="w-6 h-6" />
              צלם את הקבלה
            </DialogTitle>
          </DialogHeader>
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {!isCameraReady && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="flex items-center gap-3">
                  <Loader2 className="animate-spin h-8 w-8" />
                  <span className="text-lg">טוען מצלמה...</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCameraDialog(false)}
              className="rounded-xl"
            >
              ביטול
            </Button>
            <Button
              onClick={capturePhoto}
              disabled={!isCameraReady}
              className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-xl"
            >
              <Camera className="w-4 h-4 ml-2" />
              צלם
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}