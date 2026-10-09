import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface FeedbackModalProps {
  open: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
}

export function FeedbackModal({ open, type, title, message, onClose }: FeedbackModalProps) {
  const isSuccess = type === "success";

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md p-8 rounded-[24px] shadow-2xl bg-white border border-[#EAEAEA] [&>button]:hidden flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm ${isSuccess ? 'bg-orange-50 border border-orange-100 text-[#E65F2B]' : 'bg-[#FFF8F8] border border-[#FFEEEE] text-[#D32F2F]'}`}>
          {isSuccess ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
        </div>
        
        <h3 className="text-xl font-extrabold text-[#111111] mb-2">{title}</h3>
        <p className="text-[14px] text-[#666666] mb-8 font-medium leading-relaxed">
          {message}
        </p>
        
        <Button 
          className={`w-full h-12 rounded-xl text-[14px] font-bold text-white shadow-md transition-all hover:-translate-y-0.5 ${
            isSuccess 
              ? 'bg-[#E65F2B] hover:bg-[#D3501F] shadow-orange-500/20' 
              : 'bg-[#D32F2F] hover:bg-[#B71C1C] shadow-red-500/20'
          }`}
          onClick={onClose}
        >
          {isSuccess ? 'Lanjutkan' : 'Tutup'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
