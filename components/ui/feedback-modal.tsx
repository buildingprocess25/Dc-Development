import React from "react";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

export interface FeedbackModalProps {
  open?: boolean;
  isOpen?: boolean;
  type: "success" | "error" | "warning";
  title: string;
  message: string;
  onClose: () => void;
  className?: string;
  overlayClassName?: string;
  actionText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

export function FeedbackModal({
  open,
  isOpen,
  type,
  title,
  message,
  onClose,
  className,
  overlayClassName,
  actionText,
  cancelText,
  onConfirm,
}: FeedbackModalProps) {
  const isSuccess = type === "success";
  const isWarning = type === "warning";
  const modalOpen = open ?? isOpen ?? false;

  return (
    <Dialog open={modalOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        overlayClassName={cn("z-[99990] bg-black/65 backdrop-blur-[2px]", overlayClassName)}
        className={cn(
          "sm:max-w-md max-h-[88vh] overflow-hidden p-6 sm:p-8 rounded-[24px] shadow-2xl bg-white border border-[#EAEAEA] flex flex-col items-center text-center [&>button:last-child]:hidden z-[100000]",
          className
        )}
      >
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 shrink-0 shadow-sm ${
          isSuccess
            ? 'bg-orange-50 border border-orange-100 text-[#E65F2B]'
            : isWarning
              ? 'bg-amber-50 border border-amber-200 text-amber-600'
              : 'bg-[#FFF8F8] border border-[#FFEEEE] text-[#D32F2F]'
        }`}>
          {isSuccess ? (
            <CheckCircle2 className="w-8 h-8" />
          ) : isWarning ? (
            <AlertTriangle className="w-8 h-8" />
          ) : (
            <XCircle className="w-8 h-8" />
          )}
        </div>
        
        <h3 className="text-xl font-extrabold text-[#111111] mb-2 shrink-0">{title}</h3>
        <div className="text-[13.5px] text-[#666666] mb-6 font-medium leading-relaxed max-h-[45vh] overflow-y-auto px-2 break-words w-full">
          {message}
        </div>
        
        {onConfirm ? (
          <div className="flex items-center gap-3 w-full shrink-0">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-11 rounded-xl text-[14px] font-bold border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
              onClick={onClose}
            >
              {cancelText || "Batal"}
            </Button>
            <Button
              type="button"
              className={cn(
                "flex-1 h-11 rounded-xl text-[14px] font-bold text-white shadow-md cursor-pointer",
                isWarning ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20" : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
              )}
              onClick={onConfirm}
            >
              {actionText || "Lanjutkan"}
            </Button>
          </div>
        ) : (
          <Button 
            type="button"
            className={`w-full h-11 rounded-xl text-[14px] font-bold text-white shadow-md transition-all cursor-pointer shrink-0 ${
              isSuccess 
                ? 'bg-[#E65F2B] hover:bg-[#D3501F] shadow-orange-500/20' 
                : isWarning
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                  : 'bg-[#D32F2F] hover:bg-[#B71C1C] shadow-red-500/20'
            }`}
            onClick={onClose}
          >
            {actionText || (isSuccess ? 'Lanjutkan' : 'Tutup')}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
