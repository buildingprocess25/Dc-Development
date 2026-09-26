import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FeedbackModalProps {
  open: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
}

export function FeedbackModal({ open, type, title, message, onClose }: FeedbackModalProps) {
  if (!open) return null;

  const isSuccess = type === "success";

  return (
    <div 
      className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200"
      style={{ pointerEvents: "auto" }}
    >
      <div className="bg-white border border-[#EAEAEA] rounded-[24px] shadow-2xl p-8 max-w-sm w-full text-center scale-in-95 duration-200">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 ${isSuccess ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#FFF8F8] text-[#D32F2F]'}`}>
          {isSuccess ? <CheckCircle2 className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
        </div>
        
        <h3 className="text-xl font-extrabold text-[#111111] mb-2">{title}</h3>
        <p className="text-[14px] text-[#666666] mb-8 font-medium leading-relaxed">
          {message}
        </p>
        
        <Button 
          className={`w-full h-12 rounded-xl text-[14px] font-bold text-white shadow-sm transition-all ${
            isSuccess 
              ? 'bg-[#111111] hover:bg-[#333333]' 
              : 'bg-[#D32F2F] hover:bg-[#B71C1C]'
          }`}
          onClick={onClose}
        >
          {isSuccess ? 'Lanjutkan' : 'Tutup'}
        </Button>
      </div>
    </div>
  );
}
