import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DiscardWarningModalProps {
  open: boolean;
  onContinueEdit: () => void;
  onDiscard: () => void;
  title?: string;
  description?: string;
}

export function DiscardWarningModal({ 
  open, 
  onContinueEdit, 
  onDiscard,
  title = "Buang perubahan?",
  description = "Anda memiliki data yang belum disimpan. Yakin ingin keluar tanpa menyimpan perubahan ini?"
}: DiscardWarningModalProps) {
  if (!open) return null;

  return (
    <div 
      className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ pointerEvents: "auto" }}
    >
      <div className="bg-white border border-[#F2F2F2] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[24px] p-8 max-w-sm w-full text-center scale-in-95 duration-200">
        <div className="w-14 h-14 bg-[#FFF8F8] rounded-full flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-6 h-6 text-[#D32F2F]" />
        </div>
        <h3 className="text-xl font-extrabold text-[#111] mb-2">{title}</h3>
        <p className="text-[14px] text-[#666] mb-8 font-medium leading-relaxed px-2">
          {description}
        </p>
        <div className="flex items-center gap-3 w-full">
          <Button 
            variant="outline" 
            className="flex-1 h-12 rounded-xl text-[14px] font-bold border-[#EAEAEA] text-[#333] hover:bg-[#F9F9F9]"
            onClick={onContinueEdit}
          >
            Lanjut Edit
          </Button>
          <Button 
            className="flex-1 h-12 rounded-xl text-[14px] font-bold bg-[#D32F2F] text-white hover:bg-[#B71C1C] shadow-sm"
            onClick={onDiscard}
          >
            Ya, Buang
          </Button>
        </div>
      </div>
    </div>
  );
}
