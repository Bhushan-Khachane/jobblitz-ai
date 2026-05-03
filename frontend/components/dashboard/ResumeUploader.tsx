"use client";

import { useCallback, useState } from "react";
import { Upload, FileText, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ResumeUploaderProps {
  onUpload: (file: File) => Promise<void>;
  currentFile?: string;
}

export default function ResumeUploader({ onUpload, currentFile }: ResumeUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    }
  }, []);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }, [file, onUpload]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragging ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-2">
          Drag & drop your resume here, or
        </p>
        <label className="inline-block">
          <input type="file" accept=".pdf" className="hidden" onChange={handleSelect} />
          <span className="text-sm font-medium text-indigo-600 cursor-pointer hover:underline">
            browse files
          </span>
        </label>
        <p className="text-xs text-gray-400 mt-2">PDF only, max 10MB</p>
      </div>

      {(file || currentFile) && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <FileText className="w-5 h-5 text-indigo-600" />
          <span className="text-sm text-gray-700 flex-1 truncate">
            {file?.name || currentFile}
          </span>
          {file && (
            <button onClick={() => setFile(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
          {currentFile && !file && (
            <CheckCircle className="w-4 h-4 text-green-500" />
          )}
        </div>
      )}

      {file && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading ? "Uploading..." : "Upload Resume"}
        </Button>
      )}
    </div>
  );
}
