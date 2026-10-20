"use client";

import React from "react";
import { X, ArrowLeft, ArrowRight, Images } from "lucide-react";
import { MediaUploader } from "./MediaUploader";
import { QuestionImageItem } from "@/lib/db/schema";

export const MAX_QUESTION_IMAGES = 4;

interface ImageGalleryEditorProps {
  images: QuestionImageItem[];
  onChange: (images: QuestionImageItem[]) => void;
  max?: number;
  title?: string;
  hint?: string;
}

/**
 * Universal picture editor for a question: any number of pictures from 0 to
 * `max` can be attached, in any part of the exam. The player lays them out
 * automatically (1 big picture, 2 side by side, 3 or 4 in a grid).
 */
export function ImageGalleryEditor({
  images,
  onChange,
  max = MAX_QUESTION_IMAGES,
  title = "Savol rasmlari",
  hint,
}: ImageGalleryEditorProps) {
  const list = images || [];

  const remove = (index: number) => {
    onChange(list.filter((_, i) => i !== index));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between mb-2.5 gap-3">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Images className="w-3.5 h-3.5 text-[#0B4F37]" />
          {title}
          <span className="font-semibold text-slate-400">
            ({list.length}/{max})
          </span>
        </span>
        <span className="text-[11px] text-slate-400 text-right">
          {hint || "Ixtiyoriy — 1 tadan 4 tagacha rasm qo'shish mumkin"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {list.map((img, index) => (
          <div
            key={`${img.public_id}-${index}`}
            className="relative h-32 rounded-xl overflow-hidden border border-slate-200 bg-white group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`${index + 1}-rasm`}
              className="w-full h-full object-contain"
            />

            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold">
              {index + 1}
            </span>

            <button
              type="button"
              onClick={() => remove(index)}
              className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-md transition"
              title="Rasmni o'chirish"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="p-1 bg-black/60 hover:bg-black/80 text-white rounded-md disabled:opacity-30"
                title="Chapga surish"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === list.length - 1}
                className="p-1 bg-black/60 hover:bg-black/80 text-white rounded-md disabled:opacity-30"
                title="O'ngga surish"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {list.length < max && (
          <MediaUploader
            resourceType="image"
            variant="tile"
            tileCaption={list.length === 0 ? "Rasm qo'shish" : "Yana rasm"}
            onUploadComplete={(res) =>
              onChange([...list, { url: res.url, public_id: res.public_id }])
            }
          />
        )}
      </div>
    </div>
  );
}
