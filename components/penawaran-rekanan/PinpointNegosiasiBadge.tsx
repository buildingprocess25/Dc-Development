import React from "react";
import { AlertTriangle } from "lucide-react";

interface PinpointProps {
  catatan?: string | null;
  tipe?: "HARGA" | "DURASI";
}

export default function PinpointNegosiasiBadge({ catatan, tipe = "HARGA" }: PinpointProps) {
  return (
    <div className="mt-1 flex items-start space-x-1.5 bg-amber-50 border border-amber-300/80 rounded-xl p-2 text-amber-900 text-[11px] shadow-2xs">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded mr-1">
          Wajib Negosiasi {tipe}
        </span>
        <span className="font-medium">{catatan || "Harap sesuaikan kembali nilai ini."}</span>
      </div>
    </div>
  );
}
