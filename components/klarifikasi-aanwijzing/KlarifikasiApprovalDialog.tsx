"use client";

import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { KlarifikasiApprovalView } from "./KlarifikasiApprovalView";
import { cn } from "@/lib/utils";

export interface KlarifikasiApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: "APPROVE" | "REVISI" | null;
  klarifikasi: any | null;
  isSubmitting?: boolean;
  onConfirm: (data: {
    action: "APPROVE" | "REVISI";
    notes: string;
    detail_revisi?: any[];
  }) => Promise<void>;
  onErrorFeedback?: (title: string, message: string) => void;
  onViewPdf?: () => void;
}

/**
 * Reusable KlarifikasiApprovalDialog
 *
 * Wrapper Dialog modal yang memanfaatkan KlarifikasiApprovalView.
 * Komponen ini reusable jika dibutuhkan pemanggilan approval dialog secara standalone di tingkat halaman.
 */
export function KlarifikasiApprovalDialog({
  open,
  onOpenChange,
  actionType,
  klarifikasi,
  isSubmitting = false,
  onConfirm,
  onErrorFeedback,
  onViewPdf,
}: KlarifikasiApprovalDialogProps) {
  if (!actionType) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-slate-900/25 backdrop-blur-xs z-[100040]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className={cn(
          "p-0 overflow-hidden bg-white border border-slate-200/90 shadow-2xl rounded-2xl z-[100050] flex flex-col [&>button:last-child]:hidden max-h-[90vh] max-w-3xl"
        )}
      >
        <KlarifikasiApprovalView
          actionType={actionType}
          klarifikasi={klarifikasi}
          isSubmitting={isSubmitting}
          onBack={() => onOpenChange(false)}
          onCloseModal={() => onOpenChange(false)}
          onConfirm={onConfirm}
          onErrorFeedback={onErrorFeedback}
          onViewPdf={onViewPdf}
        />
      </DialogContent>
    </Dialog>
  );
}
