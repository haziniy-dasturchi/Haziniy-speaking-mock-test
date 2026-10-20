"use client";

import React, { useState, useRef } from "react";
import { X, Loader2, Music, ImageIcon, Plus } from "lucide-react";
import { uploadMedia } from "@/lib/client-upload";
import { AudioPlayer } from "./AudioPlayer";
import { useToast } from "./Toast";

interface MediaUploaderProps {
  resourceType: "image" | "video";
  label?: string;
  sublabel?: string;
  valueUrl?: string | null;
  valuePublicId?: string | null;
  onUploadComplete: (result: { url: string; public_id: string }) => void;
  onRemove?: () => void;
  accept?: string;
  /** Compact tile used by the image gallery ("+ add picture"). */
  variant?: "default" | "tile";
  tileCaption?: string;
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
  variant = "default",
  tileCaption,
}: MediaUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      setProgress(0);

      const res = await uploadMedia(file, resourceType, (percent) =>
        setProgress(percent)
      );

      onUploadComplete({ url: res.secure_url, public_id: res.public_id });
      showToast("Fayl muvaffaqiyatli yuklandi!", "success");
    } catch (err: any) {
      console.error("Upload error:", err);
      showToast(err?.message || "Faylni yuklashda xatolik yuz berdi", "error");
    } finally {
      setIsUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const defaultAccept =
    resourceType === "video"
      ? "audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.m4a,.wav,.ogg"
      : "image/png,image/jpeg,image/webp,image/gif";

  const hintText =
    resourceType === "video"
      ? "MP3, M4A, WAV, OGG (maks. 8 MB)"
      : "PNG, JPG, WEBP — katta rasmlar avtomatik siqiladi";

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={accept || defaultAccept}
      onChange={handleFileChange}
      className="hidden"
      disabled={isUploading}
    />
  );

  // Compact "+" tile used inside the picture gallery
  if (variant === "tile") {
    return (
      <button
        type="button"
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        disabled={isUploading}
        className={`h-32 w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer ${
          isDragging
            ? "border-[#0B4F37] bg-emerald-50"
            : "border-slate-300 hover:border-[#0B4F37] hover:bg-emerald-50/30 bg-slate-50/60"
        } disabled:cursor-not-allowed`}
      >
        {fileInput}
        {isUploading ? (
          <>
            <Loader2 className="w-5 h-5 text-[#0B4F37] animate-spin" />
            <span className="text-[11px] font-semibold text-slate-600">
              {progress}%
            </span>
          </>
        ) : (
          <>
            <span className="w-8 h-8 rounded-full bg-emerald-100 text-[#0B4F37] flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-semibold text-slate-600">
              {tileCaption || "Rasm qo'shish"}
            </span>
          </>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      {(label || sublabel) && (
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>{label}</span>
          {sublabel && <span className="text-slate-400 font-normal">{sublabel}</span>}
        </div>
      )}

      {valueUrl ? (
        <div className="relative group">
          {resourceType === "video" ? (
            <AudioPlayer src={valueUrl} onRemove={onRemove} />
          ) : (
            <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={valueUrl}
                alt="Yuklangan rasm"
                className="w-full h-full object-contain"
              />
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition"
                  title="O'chirish"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition ${
            isUploading
              ? "border-[#0B4F37] bg-emerald-50/30 cursor-not-allowed"
              : isDragging
              ? "border-[#0B4F37] bg-emerald-50"
              : "border-slate-300 hover:border-[#0B4F37] hover:bg-emerald-50/20 bg-slate-50/50"
          }`}
        >
          {fileInput}

          {isUploading ? (
            <div className="w-full max-w-xs flex flex-col items-center gap-2 py-2">
              <Loader2 className="w-6 h-6 text-[#0B4F37] animate-spin" />
              <div className="text-xs font-medium text-slate-700">
                Yuklanmoqda... {progress}%
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
              <span className="text-[11px] text-slate-400">{hintText}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
