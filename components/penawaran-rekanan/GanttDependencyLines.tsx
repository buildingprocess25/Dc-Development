"use client";

import React from "react";

interface DependencyProps {
  dependencies: { predecessor_id: number; successor_id: number }[];
  itemCoordinates: Record<number, { x: number; y: number; width: number; height: number }>;
  onDeleteDependency?: (predId: number, succId: number) => void;
  activeConnectingLine?: { startX: number; startY: number; currentX: number; currentY: number } | null;
}

export default function GanttDependencyLines({
  dependencies,
  itemCoordinates,
  onDeleteDependency,
  activeConnectingLine,
}: DependencyProps) {
  return (
    <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-20">
      <defs>
        <marker
          id="sparta-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#E65F2B" />
        </marker>
        <marker
          id="sparta-arrow-hover"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#e11d48" />
        </marker>
      </defs>

      {/* Render Garis Dependensi Aktif yang Sudah Terhubung */}
      {dependencies.map((dep, idx) => {
        const fromCoord = itemCoordinates[dep.predecessor_id];
        const toCoord = itemCoordinates[dep.successor_id];
        if (!fromCoord || !toCoord) return null;

        // Titik awal: TENGAH BAWAH dari bar pekerjaan pendahulu
        const startX = fromCoord.x + fromCoord.width / 2;
        const startY = fromCoord.y + fromCoord.height;

        // Titik akhir: TENGAH ATAS dari bar pekerjaan penerus
        const endX = toCoord.x + toCoord.width / 2;
        const endY = toCoord.y;

        const isDownwards = endY > startY;
        const deltaY = Math.max(Math.abs(endY - startY) * 0.5, 10);
        const cp1X = startX;
        const cp1Y = isDownwards ? startY + deltaY : startY + 28;
        const cp2X = endX;
        const cp2Y = isDownwards ? endY - deltaY : endY - 28;

        const pathD = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
        const isBackwards = !isDownwards;

        return (
          <g key={idx} className={onDeleteDependency ? "pointer-events-auto group cursor-pointer" : "pointer-events-none"}>
            {/* Hit area transparan agar mudah diklik untuk menghapus */}
            {onDeleteDependency && (
              <path
                d={pathD}
                fill="none"
                stroke="transparent"
                strokeWidth="16"
                className="cursor-pointer"
                onClick={() => {
                  onDeleteDependency(dep.predecessor_id, dep.successor_id);
                }}
              >
                <title>Klik untuk menghapus keterikatan</title>
              </path>
            )}

            {/* Garis visual utama kurva vertikal tengah bawah -> tengah atas */}
            <path
              d={pathD}
              fill="none"
              stroke="#E65F2B"
              strokeWidth="2.5"
              strokeDasharray={isBackwards ? "4 3" : undefined}
              markerEnd="url(#sparta-arrow)"
              className={onDeleteDependency ? "group-hover:stroke-rose-600 group-hover:marker-end-[url(#sparta-arrow-hover)] transition-colors" : undefined}
            />
          </g>
        );
      })}

      {/* Render Rubberband Line saat Kontraktor sedang Menarik Tali */}
      {activeConnectingLine && (() => {
        const { startX, startY, currentX, currentY } = activeConnectingLine;
        const deltaY = Math.max(Math.abs(currentY - startY) * 0.5, 12);
        const cp1Y = currentY >= startY ? startY + deltaY : startY + 24;
        const cp2Y = currentY >= startY ? currentY - deltaY : currentY - 24;
        const pathD = `M ${startX} ${startY} C ${startX} ${cp1Y}, ${currentX} ${cp2Y}, ${currentX} ${currentY}`;
        return (
          <path
            d={pathD}
            fill="none"
            stroke="#E65F2B"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            markerEnd="url(#sparta-arrow)"
            className="animate-pulse"
          />
        );
      })()}
    </svg>
  );
}
