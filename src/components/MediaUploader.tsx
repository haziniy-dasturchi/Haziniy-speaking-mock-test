"use client";

import React, { useState, useRef } from "react";
import { Upload, X, Loader2, Music, ImageIcon } from "lucide-react";
import { uploadMediaToCloudinary, UploadResult } from "@/lib/client-upload";
import { AudioPlayer } from "./AudioPlayer";
import { useToast } from "./Toast";
import Image from "next/image";

interface MediaUploaderProps {
  resourceType: "image" | "video";
  label: string;
  sublabel?: string;
  valueUrl?: string | null;
  valuePublicId?: string | null;
  onUploadComplete: (result: { url: string; public_id: string }) => void;
  onRemove: () => void;
  accept?: string;
}

export function MediaUploader({
  resourceType,
  label,
  sublabel,
  valueUrl,
  valuePublicId,
  onUploadComplete,
  onRemove,
  accept,
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setProgress(0);

      const res = await uploadMediaToCloudinary(
        file,
        resourceType,
        (percent) => setProgress(percent)
      );

      onUploadComplete({
        url: res.secure_url,
        public_id: res.public_id,
      });

      showToast("Fayl muvaffaqiyatli yuklandi!", "success");
    } catch (err: any) {
      console.error("Upload error:", err);
      showToast(err.message || "Faylni yuklashda xatolik yuz berdi", "error");
    } finally {
      setIsUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const defaultAccept =
    resourceType === "video"
      ? "audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/ogg,.mp3,.m4a,.wav,.ogg"
      : "image/*";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        {sublabel && <span className="text-slate-400 font-normal">{sublabel}</span>}
      </div>

      {valueUrl ? (
        <div className="relative group">
          {resourceType === "video" ? (
            <AudioPlayer src={valueUrl} onRemove={onRemove} />
          ) : (
            <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group">
              <img
                src={valueUrl}
                alt="Uploaded media"
                className="w-full h-full object-contain"
              />
              <button
                type="button"
                onClick={onRemove}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition"
                title="O'chirish"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition ${
            isUploading
              ? "border-[#0B4F37] bg-emerald-50/30 cursor-not-allowed"
              : "border-slate-250 hover:border-[#0B4F37] hover:bg-emerald-50/20 bg-slate-50/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept || defaultAccept}
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="w-full max-w-xs flex flex-col items-center gap-2 py-2">
              <Loader2 className="w-6 h-6 text-[#0B4F37] animate-spin" />
              <div className="text-xs font-medium text-slate-700">
                Cloudinary ga yuklanmoqda... {progress}%
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0B4F37] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-1">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-[#0B4F37]">
                {resourceType === "video" ? (
                  <Music className="w-4 h-4" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
              </div>
              <span className="text-xs font-medium text-slate-700">
                Fayl tanlash yoki bu yerga tashlash
              </span>
              <span className="text-[11px] text-slate-400">
                {resourceType === "video"
                  ? "MP3, M4A, WAV, OGG (maks. 10 MB)"
                  : "PNG, JPG, WEBP (maks. 1600px)"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
