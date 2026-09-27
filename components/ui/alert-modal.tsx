import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertType = 'error' | 'success' | 'warning';

export interface AlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
}

export function AlertModal({
  open,
  onOpenChange,
  title,
  message,
  type = 'error',
  confirmText = "Oke, Mengerti"
}: AlertModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden bg-white rounded-3xl border-0 shadow-2xl z-[9999] duration-200">
        <div className="p-8 flex flex-col items-center text-center gap-5">
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center mb-1 transition-colors duration-300",
            type === 'error' ? "bg-red-50 text-red-500" :
            type === 'warning' ? "bg-amber-50 text-amber-500" :
            "bg-green-50 text-green-500"
          )}>
            {type === 'error' && <AlertCircle className="w-10 h-10" />}
            {type === 'warning' && <AlertCircle className="w-10 h-10" />}
            {type === 'success' && <CheckCircle2 className="w-10 h-10" />}
          </div>
          
          <div className="flex flex-col gap-2">
            <h3 className="text-xl font-black text-[#111111] tracking-tight">{title}</h3>
            <p className="text-[13px] font-medium text-slate-500 leading-relaxed max-w-[280px] mx-auto">
              {message}
            </p>
          </div>
          
          <button 
            onClick={() => onOpenChange(false)}
            className={cn(
              "mt-3 w-full py-3.5 rounded-2xl text-sm font-extrabold text-white transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]",
              type === 'error' ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" :
              type === 'warning' ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20" :
              "bg-[#E65F2B] hover:bg-[#D3501F] shadow-orange-500/20"
            )}
          >
            {confirmText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
