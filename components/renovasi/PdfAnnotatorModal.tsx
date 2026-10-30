"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { jsPDF } from "jspdf";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import {
  AnnotationObject,
  AnnotationPoint,
  AnnotationTool,
  DocumentAnnotationPayload,
  PageAnnotation,
  RoleAnnotationLayer,
} from "@/lib/types/pdf-annotation";
import {
  PenTool,
  Square,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  X,
  Loader2,
  CheckCircle2,
  User,
  Layers,
  Sparkles,
  AlertCircle,
  FileCode2,
  Check,
  ExternalLink,
  History
} from "lucide-react";
import { FeedbackModal } from "@/components/ui/feedback-modal";
import { cn } from "@/lib/utils";
import { getApprovalStageInfo, getShortRoleName } from "@/lib/approval-stage";

interface PdfAnnotatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: {
    id: number;
    nama_file: string;
    file_url?: string;
    drive_file_id?: string;
    kategori_file?: string;
    nama_label?: string;
  } | null;
  renovasiId: number;
  isReadOnly?: boolean;
  currentAction?: "REVISI" | "TOLAK" | "APPROVE";
  initialLayerId?: string | number;
  existingCoretanDocId?: number;
  currentApprovalStatus?: string;
  approvalStageRole?: string;
  onSaveSuccess?: (savedDoc: any) => void;
}

const COLOR_PRESETS = [
  { name: "Merah Redline (Revisi)", value: "#DC2626" },
  { name: "Biru Catatan Teknis", value: "#1D4ED8" },
  { name: "Hijau Verifikasi (OK)", value: "#16A34A" },
  { name: "Hitam Tinta Teknis", value: "#1E293B" },
  { name: "Oranye SPARTA", value: "#E65F2B" },
  { name: "Kuning Sorotan", value: "#FBBF24" },
];

const LINE_WIDTHS = [
  { label: "Tipis", value: 2 },
  { label: "Sedang", value: 4 },
  { label: "Tebal", value: 8 },
];

export default function PdfAnnotatorModal({
  open,
  onOpenChange,
  doc,
  renovasiId,
  isReadOnly = false,
  currentAction = "REVISI",
  initialLayerId,
  existingCoretanDocId,
  currentApprovalStatus,
  approvalStageRole,
  onSaveSuccess,
}: PdfAnnotatorModalProps) {
  const { user } = useSession();

  // Evaluasi Tahap Alur Approval aktif (berdasarkan status pengajuan & role approver)
  const stageInfo = getApprovalStageInfo(
    currentApprovalStatus,
    approvalStageRole || user?.role
  );

  // PDF Document State
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [loadingPdf, setLoadingPdf] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Cache dokumen PDF loaded untuk pergantian layer instan tanpa re-fetch
  const pdfDocCacheRef = useRef<Map<number, any>>(new Map());

  // Canvas Refs
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Annotation Tooling
  const [activeTool, setActiveTool] = useState<AnnotationTool>("PEN");
  const [activeColor, setActiveColor] = useState<string>("#DC2626");
  const [activeLineWidth, setActiveLineWidth] = useState<number>(4);

  // All layers loaded from DB
  const [layers, setLayers] = useState<RoleAnnotationLayer[]>([]);
  const [loadingLayers, setLoadingLayers] = useState<boolean>(false);
  const [existingStageCoretan, setExistingStageCoretan] = useState<RoleAnnotationLayer | null>(
    existingCoretanDocId ? ({ id: existingCoretanDocId } as any) : null
  );

  useEffect(() => {
    if (existingCoretanDocId) {
      setExistingStageCoretan((prev) =>
        prev ? { ...prev, id: existingCoretanDocId } : ({ id: existingCoretanDocId } as any)
      );
    }
  }, [existingCoretanDocId]);

  // Active view layer: "MY_EDIT" | "CLEAN" | number (layer id)
  const [activeLayerId, setActiveLayerId] = useState<string | number>(
    initialLayerId ?? (isReadOnly ? "CLEAN" : "MY_EDIT")
  );

  // Local working state of current user's annotations: pageIndex -> AnnotationObject[]
  const [myAnnotations, setMyAnnotations] = useState<Record<number, AnnotationObject[]>>({});
  const [historyStack, setHistoryStack] = useState<Record<number, AnnotationObject[][]>>({});
  const [redoStack, setRedoStack] = useState<Record<number, AnnotationObject[][]>>({});

  // Drawing in progress
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<AnnotationPoint[]>([]);
  const [rectStart, setRectStart] = useState<AnnotationPoint | null>(null);
  const [rectCurrent, setRectCurrent] = useState<AnnotationPoint | null>(null);

  // Text Prompt inline
  const [textPromptPos, setTextPromptPos] = useState<AnnotationPoint | null>(null);
  const [textContent, setTextContent] = useState("");

  const [saving, setSaving] = useState(false);
  const savedDocRef = useRef<any>(null);
  const [feedbackModal, setFeedbackModal] = useState<{
    open: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    open: false,
    type: "success",
    title: "",
    message: "",
  });

  const handleCloseFeedback = () => {
    const wasSuccess = feedbackModal.type === "success";
    setFeedbackModal((prev) => ({ ...prev, open: false }));
    if (wasSuccess) {
      if (savedDocRef.current && onSaveSuccess) {
        onSaveSuccess(savedDocRef.current);
      }
      onOpenChange(false);
    }
  };

  // 1. Load Layers from Server whenever modal opens or doc changes
  const loadLayers = useCallback(async () => {
    if (!doc?.id || !renovasiId) return;
    try {
      setLoadingLayers(true);
      const res = await fetch(`/api/dc-development/renovasi/${renovasiId}/dokumen/${doc.id}/coretan-pdf`);
      const json = await res.json();
      if (res.ok && json.status === "success") {
        const fetchedLayers: RoleAnnotationLayer[] = (json.data || []).map((item: any) => {
          const rawLabel = item.nama_label || item.nama_file || "";
          let extractedNama = item.user_nama || "";
          let extractedRole = item.user_role || "";

          if (!extractedNama && rawLabel) {
            const match = rawLabel.match(/oleh\s+(.*?)\s*\((.*?)\)/i);
            if (match) {
              extractedNama = match[1]?.trim();
              extractedRole = match[2]?.trim();
            } else {
              extractedNama = (item.nama_file || "")
                .replace(/^Coretan_/, "")
                .replace(/\.pdf$/i, "")
                .replace(/_/g, " ");
              extractedRole = item.kategori_file?.includes("SIPIL") ? "Gambar Sipil" : "Gambar ME";
            }
          }

          return {
            id: item.id,
            dokumen_id: item.dokumen_id || doc.id,
            user_email: item.user_email || "",
            user_nama: extractedNama || "Reviewer",
            user_role: extractedRole || "REVIEWER",
            status_aksi: item.status_aksi || "REVISI",
            catatan: item.catatan || "",
            file_url: item.file_url,
            drive_file_id: item.drive_file_id,
            nama_file: item.nama_file || "",
            nama_label: item.nama_label || rawLabel,
            tahap_alur: item.tahap_alur || "",
            anotasi_json: item.anotasi_json || { pages: [] },
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.created_at || new Date().toISOString(),
          };
        });

        setLayers(fetchedLayers);

        // Hanya edit coretan jika existingCoretanDocId secara eksplisit dipassing dari caller (sesi aktif saat ini)
        // Jika tidak dipassing, maka approver sedang membuat CORETAN BARU pada berkas pengajuan terkini
        const foundStageCoretan = existingCoretanDocId
          ? fetchedLayers.find((l) => l.id === existingCoretanDocId)
          : null;
        setExistingStageCoretan(foundStageCoretan || null);

        // Hanya load goresan vektor lama jika secara spesifik sedang mengedit existingCoretanDocId
        if (foundStageCoretan && foundStageCoretan.anotasi_json?.pages) {
          const map: Record<number, AnnotationObject[]> = {};
          foundStageCoretan.anotasi_json.pages.forEach((p) => {
            map[p.pageIndex] = p.objects || [];
          });
          setMyAnnotations(map);
        } else {
          setMyAnnotations({});
        }

        // Default active layer jika read-only atau initialLayerId tersedia
        if (isReadOnly) {
          if (initialLayerId !== undefined && fetchedLayers.some((l) => l.id === initialLayerId)) {
            setActiveLayerId(initialLayerId);
          } else if (fetchedLayers.length > 0) {
            setActiveLayerId(fetchedLayers[0].id);
          } else {
            setActiveLayerId("CLEAN");
          }
        } else {
          if (initialLayerId !== undefined) {
            setActiveLayerId(initialLayerId);
          } else {
            setActiveLayerId("MY_EDIT");
          }
        }
      }
    } catch (err: any) {
      console.warn("Gagal memuat layer anotasi:", err);
    } finally {
      setLoadingLayers(false);
    }
  }, [doc?.id, renovasiId, user?.email, isReadOnly, initialLayerId, stageInfo.code, existingCoretanDocId]);

  // Bersihkan cache saat modal ditutup
  useEffect(() => {
    if (!open) {
      pdfDocCacheRef.current.clear();
      setPdfDoc(null);
      setNumPages(0);
    }
  }, [open]);

  // Sinkronisasi jika initialLayerId berubah dari luar
  useEffect(() => {
    if (initialLayerId !== undefined) {
      setActiveLayerId(initialLayerId);
    }
  }, [initialLayerId]);

  // 2. Load PDF using dynamic import of pdfjs-dist
  useEffect(() => {
    if (!open || !doc) return;

    let isCancelled = false;
    setLoadingPdf(true);
    setPdfError(null);

    // Dokumen target:
    // 1. Jika activeLayerId adalah number: muat layer reviewer/coretan spesifik tersebut
    // 2. Jika activeLayerId === "MY_EDIT":
    //    - Jika coretan lama belum memiliki anotasi_json vektor (legacy), muat file coretan lama tersebut
    //    - Jika fresh atau sudah ada anotasi_json vektor, selalu muat doc.id (dokumen asli yang tajam, jernih & bervektor murni)
    // 3. Jika activeLayerId === "CLEAN": muat doc.id (gambar bersih asli)
    // Dokumen target:
    // 1. Jika activeLayerId adalah number: muat layer reviewer/coretan spesifik tersebut
    // 2. Jika activeLayerId === "MY_EDIT" atau "CLEAN": SELALU muat doc.id (dokumen asli yang tajam, jernih & bervektor murni)
    //    Coretan sebelumnya akan dimuat secara terpisah sebagai layer vektor overlay dari anotasi_json.
    const targetDocId = typeof activeLayerId === "number" ? activeLayerId : doc.id;

    // Cek cache memori terlebih dahulu agar transisi tab instan tanpa loading
    const cachedDoc = targetDocId ? pdfDocCacheRef.current.get(targetDocId) : null;
    if (cachedDoc && typeof cachedDoc.numPages === "number" && cachedDoc.numPages > 0) {
      setPdfDoc(cachedDoc);
      setNumPages(cachedDoc.numPages);
      setLoadingPdf(false);
      return;
    } else if (targetDocId) {
      pdfDocCacheRef.current.delete(targetDocId);
    }

    const loadPdf = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        // Gunakan worker lokal mandiri di /public/pdf.worker.min.mjs untuk kehandalan 100% tanpa CORS/CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        // URL via proxy internal dengan timestamp anti-cache untuk memastikan berkas selalu fresh
        const proxyUrl = `/api/dc-development/renovasi/${renovasiId}/dokumen/${targetDocId}/pdf-proxy?t=${Date.now()}`;
        const loadingTask = pdfjsLib.getDocument({
          url: proxyUrl,
          withCredentials: true,
        });

        const loadedDoc = await loadingTask.promise;
        if (!isCancelled) {
          if (loadedDoc && typeof loadedDoc.numPages === "number") {
            pdfDocCacheRef.current.set(targetDocId, loadedDoc);
            setPdfDoc(loadedDoc);
            setNumPages(loadedDoc.numPages);
          }
          setLoadingPdf(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Gagal memuat dokumen PDF:", err);
          setPdfError(
            err.message ||
            "Dokumen PDF tidak dapat dimuat atau berformat tidak didukung peramban."
          );
          setLoadingPdf(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [open, doc, renovasiId, activeLayerId]);

  // Muat data layer coretan setiap kali modal dibuka atau doc berganti
  useEffect(() => {
    if (open && doc?.id) {
      loadLayers();
    }
  }, [open, doc?.id, loadLayers]);

  // 3. Render Current PDF Page onto background canvas dengan dukungan Retina / High-DPI
  useEffect(() => {
    if (!pdfDoc || !bgCanvasRef.current) return;

    let renderTask: any = null;
    let isCancelled = false;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        // Gunakan devicePixelRatio agar pada monitor resolusi tinggi / scaling Windows 125%-150% teks tetap tajam 100%
        const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 1) : 1;
        const viewport = page.getViewport({ scale });
        setPageSize({ width: viewport.width, height: viewport.height });

        const bgCanvas = bgCanvasRef.current;
        const drawCanvas = drawCanvasRef.current;
        if (!bgCanvas) return;

        bgCanvas.width = Math.round(viewport.width * dpr);
        bgCanvas.height = Math.round(viewport.height * dpr);
        bgCanvas.style.width = `${viewport.width}px`;
        bgCanvas.style.height = `${viewport.height}px`;

        if (drawCanvas) {
          drawCanvas.width = Math.round(viewport.width * dpr);
          drawCanvas.height = Math.round(viewport.height * dpr);
          drawCanvas.style.width = `${viewport.width}px`;
          drawCanvas.style.height = `${viewport.height}px`;
        }

        const ctx = bgCanvas.getContext("2d");
        if (!ctx) return;

        // Render viewport dengan perbesaran dpr agar bebas blur pada tampilan layar
        renderTask = page.render({
          canvasContext: ctx,
          viewport: page.getViewport({ scale: scale * dpr }),
        });

        await renderTask.promise;
        // Redraw annotations layer after page renders
        redrawOverlay();
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.warn("Gagal merender halaman PDF:", err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, currentPage, scale, loadingPdf]);

  // Determine which objects to display based on activeLayerId
  const getVisibleObjectsForCurrentPage = useCallback((): AnnotationObject[] => {
    if (activeLayerId === "CLEAN") {
      return [];
    }

    if (activeLayerId === "MY_EDIT") {
      return myAnnotations[currentPage] || [];
    }

    // A specific role's layer
    const targetLayer = layers.find((l) => l.id === activeLayerId);
    if (!targetLayer || !targetLayer.anotasi_json?.pages) return [];

    const pageData = targetLayer.anotasi_json.pages.find((p) => p.pageIndex === currentPage);
    return pageData ? pageData.objects || [] : [];
  }, [activeLayerId, currentPage, myAnnotations, layers]);

  // Redraw overlay canvas
  const redrawOverlay = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 1) : 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const objects = getVisibleObjectsForCurrentPage();

    objects.forEach((obj) => {
      ctx.save();
      ctx.strokeStyle = obj.color;
      ctx.fillStyle = obj.color;
      ctx.lineWidth = obj.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (obj.tool === "PEN" && obj.points && obj.points.length > 0) {
        ctx.beginPath();
        obj.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      } else if (obj.tool === "RECTANGLE" && obj.rect) {
        ctx.strokeRect(obj.rect.x, obj.rect.y, obj.rect.width, obj.rect.height);
        // Semi-transparent fill highlight
        ctx.fillStyle = `${obj.color}18`;
        ctx.fillRect(obj.rect.x, obj.rect.y, obj.rect.width, obj.rect.height);
      } else if (obj.tool === "TEXT" && obj.text) {
        const fontSize = obj.text.fontSize || 14;
        ctx.font = `bold ${fontSize}px sans-serif`;

        // Draw note background tag
        const textMetrics = ctx.measureText(obj.text.content);
        const padX = 8;
        const padY = 4;
        const boxW = textMetrics.width + padX * 2;
        const boxH = fontSize + padY * 2;

        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.roundRect(obj.text.x, obj.text.y - fontSize, boxW, boxH, 6);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.fillText(obj.text.content, obj.text.x + padX, obj.text.y);
      }
      ctx.restore();
    });

    ctx.restore();
  }, [getVisibleObjectsForCurrentPage]);

  // Redraw whenever visible objects or page changes
  useEffect(() => {
    redrawOverlay();
  }, [redrawOverlay, activeLayerId, myAnnotations, currentPage]);

  // Pointer event coordinate extractor (mengembalikan koordinat piksel CSS layar normal)
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): AnnotationPoint => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  // Push state to undo stack
  const saveUndoSnapshot = () => {
    const currentObjs = myAnnotations[currentPage] || [];
    setHistoryStack((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), [...currentObjs]],
    }));
    setRedoStack((prev) => ({
      ...prev,
      [currentPage]: [],
    }));
  };

  // Start Drawing
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isReadOnly || activeLayerId !== "MY_EDIT") return;
    const pt = getCanvasCoords(e);

    if (activeTool === "TEXT") {
      setTextPromptPos(pt);
      setTextContent("");
      return;
    }

    if (activeTool === "ERASER") {
      // Find object closest to click pos and delete it
      const currentList = myAnnotations[currentPage] || [];
      const threshold = 16;
      const filtered = currentList.filter((obj) => {
        if (obj.tool === "PEN" && obj.points) {
          return !obj.points.some(
            (p) => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold
          );
        }
        if (obj.tool === "RECTANGLE" && obj.rect) {
          return !(
            pt.x >= obj.rect.x &&
            pt.x <= obj.rect.x + obj.rect.width &&
            pt.y >= obj.rect.y &&
            pt.y <= obj.rect.y + obj.rect.height
          );
        }
        if (obj.tool === "TEXT" && obj.text) {
          return !(Math.hypot(obj.text.x - pt.x, obj.text.y - pt.y) < 30);
        }
        return true;
      });

      if (filtered.length !== currentList.length) {
        saveUndoSnapshot();
        setMyAnnotations((prev) => ({ ...prev, [currentPage]: filtered }));
      }
      return;
    }

    saveUndoSnapshot();
    setIsDrawing(true);

    if (activeTool === "PEN") {
      setCurrentStroke([pt]);
    } else if (activeTool === "RECTANGLE") {
      setRectStart(pt);
      setRectCurrent(pt);
    }
  };

  // Dragging / Drawing
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isReadOnly || activeLayerId !== "MY_EDIT") return;
    const pt = getCanvasCoords(e);

    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (activeTool === "PEN") {
      setCurrentStroke((prev) => [...prev, pt]);

      const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 1) : 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeLineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (currentStroke.length > 0) {
        const prevPt = currentStroke[currentStroke.length - 1];
        ctx.beginPath();
        ctx.moveTo(prevPt.x, prevPt.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (activeTool === "RECTANGLE" && rectStart) {
      setRectCurrent(pt);
      redrawOverlay();

      const dpr = typeof window !== "undefined" ? Math.max(window.devicePixelRatio || 1, 1) : 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeLineWidth;
      ctx.setLineDash([4, 4]);
      const w = pt.x - rectStart.x;
      const h = pt.y - rectStart.y;
      ctx.strokeRect(rectStart.x, rectStart.y, w, h);
      ctx.restore();
    }
  };

  // Finish Drawing
  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === "PEN" && currentStroke.length > 0) {
      const newObj: AnnotationObject = {
        id: `pen_${Date.now()}_${Math.random()}`,
        tool: "PEN",
        color: activeColor,
        lineWidth: activeLineWidth,
        points: currentStroke,
      };

      setMyAnnotations((prev) => ({
        ...prev,
        [currentPage]: [...(prev[currentPage] || []), newObj],
      }));
      setCurrentStroke([]);
    } else if (activeTool === "RECTANGLE" && rectStart && rectCurrent) {
      const x = Math.min(rectStart.x, rectCurrent.x);
      const y = Math.min(rectStart.y, rectCurrent.y);
      const width = Math.abs(rectCurrent.x - rectStart.x);
      const height = Math.abs(rectCurrent.y - rectStart.y);

      if (width > 5 && height > 5) {
        const newObj: AnnotationObject = {
          id: `rect_${Date.now()}_${Math.random()}`,
          tool: "RECTANGLE",
          color: activeColor,
          lineWidth: activeLineWidth,
          rect: { x, y, width, height },
        };

        setMyAnnotations((prev) => ({
          ...prev,
          [currentPage]: [...(prev[currentPage] || []), newObj],
        }));
      }

      setRectStart(null);
      setRectCurrent(null);
      redrawOverlay();
    }
  };

  // Commit text note
  const handleAddText = () => {
    if (!textPromptPos || !textContent.trim()) {
      setTextPromptPos(null);
      return;
    }

    saveUndoSnapshot();
    const newObj: AnnotationObject = {
      id: `text_${Date.now()}_${Math.random()}`,
      tool: "TEXT",
      color: activeColor,
      lineWidth: 2,
      text: {
        x: textPromptPos.x,
        y: textPromptPos.y,
        content: textContent.trim(),
        fontSize: 14,
      },
    };

    setMyAnnotations((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), newObj],
    }));

    setTextPromptPos(null);
    setTextContent("");
  };

  // Undo / Redo
  const handleUndo = useCallback(() => {
    const stack = historyStack[currentPage] || [];
    if (stack.length === 0) return;

    const previousState = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);

    const currentObjs = myAnnotations[currentPage] || [];
    setRedoStack((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), [...currentObjs]],
    }));

    setHistoryStack((prev) => ({
      ...prev,
      [currentPage]: newStack,
    }));

    setMyAnnotations((prev) => ({
      ...prev,
      [currentPage]: previousState,
    }));
  }, [historyStack, currentPage, myAnnotations]);

  const handleRedo = useCallback(() => {
    const rStack = redoStack[currentPage] || [];
    if (rStack.length === 0) return;

    const nextState = rStack[rStack.length - 1];
    const newRStack = rStack.slice(0, -1);

    const currentObjs = myAnnotations[currentPage] || [];
    setHistoryStack((prev) => ({
      ...prev,
      [currentPage]: [...(prev[currentPage] || []), [...currentObjs]],
    }));

    setRedoStack((prev) => ({
      ...prev,
      [currentPage]: newRStack,
    }));

    setMyAnnotations((prev) => ({
      ...prev,
      [currentPage]: nextState,
    }));
  }, [redoStack, currentPage, myAnnotations]);

  const handleClearPage = () => {
    saveUndoSnapshot();
    setMyAnnotations((prev) => ({
      ...prev,
      [currentPage]: [],
    }));
  };

  // Keyboard Shortcuts: Ctrl+Z (Undo) & Ctrl+Y / Ctrl+Shift+Z (Redo)
  useEffect(() => {
    if (!open || isReadOnly || activeLayerId !== "MY_EDIT") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Abaikan jika fokus sedang berada pada input teks atau textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isReadOnly, activeLayerId, handleUndo, handleRedo]);

  // Helper untuk menghasilkan berkas PDF utuh yang menggabungkan halaman PDF asli dengan coretan anotasi
  // Menggunakan pdf-lib untuk mempertahankan 100% ketajaman teks & elemen vektor asli tanpa blur/rasterisasi
  const generateAnnotatedPdfBlob = async (): Promise<Blob> => {
    if (!doc?.id || !renovasiId) {
      throw new Error("Dokumen PDF belum siap atau belum selesai dimuat.");
    }

    // 1. Ambil berkas PDF asli (vektor murni) dari server via pdf-proxy
    const proxyUrl = `/api/dc-development/renovasi/${renovasiId}/dokumen/${doc.id}/pdf-proxy?t=${Date.now()}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      throw new Error("Gagal mengunduh berkas PDF acuan dari server.");
    }
    const originalPdfBytes = await res.arrayBuffer();

    // 2. Muat dokumen PDF asli menggunakan pdf-lib (100% teks & vektor tetap utuh)
    const { PDFDocument, degrees } = await import("pdf-lib");
    const loadedPdf = await PDFDocument.load(originalPdfBytes);
    const totalPages = loadedPdf.getPageCount();

    // 3. Render layer anotasi transparan beresolusi tinggi (3x) untuk halaman yang memiliki coretan
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageObjs = myAnnotations[pageNum] || [];
      if (pageObjs.length === 0) continue; // Halaman tanpa coretan dibiarkan murni apa adanya

      const pdfPage = loadedPdf.getPage(pageNum - 1);
      const { width: pageWidth, height: pageHeight } = pdfPage.getSize();

      // Resolusi overlay 3x untuk memastikan coretan bebas bergerigi & sangat halus
      const RENDER_SCALE = 3;
      const overlayCanvas = document.createElement("canvas");
      overlayCanvas.width = Math.round(pageWidth * RENDER_SCALE);
      overlayCanvas.height = Math.round(pageHeight * RENDER_SCALE);

      const ctx = overlayCanvas.getContext("2d");
      if (!ctx) continue;

      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      // Rasio koordinat dari canvas tampilan ke overlayCanvas beresolusi tinggi
      const coordRatio = RENDER_SCALE / scale;

      pageObjs.forEach((obj) => {
        ctx.save();
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = Math.max(1, obj.lineWidth * coordRatio);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (obj.tool === "PEN" && obj.points && obj.points.length > 0) {
          ctx.beginPath();
          obj.points.forEach((pt, i) => {
            const px = pt.x * coordRatio;
            const py = pt.y * coordRatio;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        } else if (obj.tool === "RECTANGLE" && obj.rect) {
          const rx = obj.rect.x * coordRatio;
          const ry = obj.rect.y * coordRatio;
          const rw = obj.rect.width * coordRatio;
          const rh = obj.rect.height * coordRatio;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.fillStyle = `${obj.color}22`;
          ctx.fillRect(rx, ry, rw, rh);
        } else if (obj.tool === "TEXT" && obj.text) {
          const fontSize = Math.max(10, (obj.text.fontSize || 14) * coordRatio);
          ctx.font = `bold ${fontSize}px sans-serif`;
          const textMetrics = ctx.measureText(obj.text.content);
          const padX = 8 * coordRatio;
          const padY = 4 * coordRatio;
          const boxW = textMetrics.width + padX * 2;
          const boxH = fontSize + padY * 2;

          const tx = obj.text.x * coordRatio;
          const ty = obj.text.y * coordRatio;

          ctx.fillStyle = obj.color;
          ctx.beginPath();
          ctx.roundRect(tx, ty - fontSize, boxW, boxH, 6 * coordRatio);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(obj.text.content, tx + padX, ty);
        }
        ctx.restore();
      });

      // Konversi overlayCanvas ke transparent PNG bytes
      const pngDataUrl = overlayCanvas.toDataURL("image/png");
      const base64Data = pngDataUrl.split(",")[1];
      const binaryStr = atob(base64Data);
      const pngBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        pngBytes[i] = binaryStr.charCodeAt(i);
      }

      // Embed transparent PNG ke dokumen pdf-lib
      const embeddedPng = await loadedPdf.embedPng(pngBytes);
      const rotationAngle = (pdfPage.getRotation().angle || 0) % 360;

      if (rotationAngle === 0) {
        pdfPage.drawImage(embeddedPng, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        });
      } else if (rotationAngle === 90) {
        pdfPage.drawImage(embeddedPng, {
          x: 0,
          y: pageHeight,
          width: pageHeight,
          height: pageWidth,
          rotate: degrees(-90),
        });
      } else if (rotationAngle === 180) {
        pdfPage.drawImage(embeddedPng, {
          x: pageWidth,
          y: pageHeight,
          width: pageWidth,
          height: pageHeight,
          rotate: degrees(180),
        });
      } else if (rotationAngle === 270) {
        pdfPage.drawImage(embeddedPng, {
          x: pageWidth,
          y: 0,
          width: pageHeight,
          height: pageWidth,
          rotate: degrees(90),
        });
      }
    }

    // Ekspor dokumen PDF utuh (vektor murni + layer coretan PNG transparan di atasnya)
    const finalPdfBytes = await loadedPdf.save();
    return new Blob([finalPdfBytes as unknown as BlobPart], { type: "application/pdf" });
  };

  // Simpan PDF coretan: Upload ke Google Drive dan simpan link ke database
  const handleSave = async () => {
    if (!doc?.id || !renovasiId || !user) return;

    try {
      setSaving(true);

      // 1. Cek apakah ada coretan yang dibuat
      const hasAnyStroke = Object.values(myAnnotations).some((arr) => arr && arr.length > 0);
      if (!hasAnyStroke && !existingStageCoretan) {
        setFeedbackModal({
          open: true,
          type: "error",
          title: "Belum Ada Coretan",
          message: "Silakan buat coretan, garis, atau catatan visual terlebih dahulu pada lembar gambar sebelum menyimpan.",
        });
        setSaving(false);
        return;
      }

      // 2. Render dan kompilasi PDF utuh dengan coretan
      const pdfBlob = await generateAnnotatedPdfBlob();

      // 3. Siapkan file FormData
      const cleanDocName = (doc.nama_file || "Gambar.pdf")
        .replace(/^(?:Coretan|Revisi_DWG)_[A-Z0-9_]+?_\d{8}_\d{6}_/i, "")
        .replace(/^(?:Coretan|Revisi_DWG)_[A-Z0-9_]+?_/i, "")
        .replace(/\.pdf$/i, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      
      // Nama berkas mengikat kode tahap alur agar unik per tahap approval
      const fileName = `Coretan_${stageInfo.code}_${cleanDocName}.pdf`;
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_email", user.email);
      formData.append("user_nama", user.namaLengkap || user.email);
      formData.append("user_role", user.role);
      formData.append("status_aksi", currentAction);
      formData.append("tahap_alur", stageInfo.code);
      formData.append("status_tahap", currentApprovalStatus || "");
      formData.append(
        "nama_label",
        `Coretan ${currentAction === "APPROVE" ? "Persetujuan" : "Revisi"} (Tahap ${stageInfo.label}) oleh ${user.namaLengkap || user.email} (${user.role})`
      );

      // Sertakan struktur vektor anotasi_json agar revisi berikutnya tetap beresolusi penuh
      const anotasiJsonPayload = {
        pages: Object.entries(myAnnotations).map(([pIndex, objs]) => ({
          pageIndex: Number(pIndex),
          scaleWhenDrawn: scale,
          objects: objs,
        })),
      };
      formData.append("anotasi_json", JSON.stringify(anotasiJsonPayload));

      // Jika memperbarui coretan yang sudah ada pada tahap ini, kirim ID agar di-update
      const targetExistingId = existingCoretanDocId || existingStageCoretan?.id;
      if (targetExistingId) {
        formData.append("existing_coretan_id", String(targetExistingId));
      }

      // 4. Unggah ke Google Drive dan simpan link ke database
      const res = await fetch(
        `/api/dc-development/renovasi/${renovasiId}/dokumen/${doc.id}/coretan-pdf`,
        {
          method: "POST",
          body: formData,
        }
      );

      const json = await res.json();
      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Gagal menyimpan coretan ke Google Drive");
      }

      savedDocRef.current = json.data;
      
      // Update state existing stage layer agar kanvas langsung sinkron
      setExistingStageCoretan(json.data);
      setHistoryStack({});
      setRedoStack({});
      if (json.data?.id) {
        pdfDocCacheRef.current.delete(json.data.id); // Invalidate cache
      }
      if (doc?.id) {
        pdfDocCacheRef.current.delete(doc.id);
      }

      setFeedbackModal({
        open: true,
        type: "success",
        title: json.data?.is_updated
          ? "Coretan Tahap Ini Berhasil Diperbarui"
          : "Coretan Baru Tahap Ini Berhasil Disimpan",
        message: `Berkas PDF anotasi dan coretan visual untuk Tahap ${stageInfo.label} (${json.data?.nama_file || "Coretan.pdf"}) berhasil disimpan ke Google Drive dan database.`,
      });
    } catch (err: any) {
      console.error("Error saving annotations to Google Drive:", err);
      setFeedbackModal({
        open: true,
        type: "error",
        title: "Gagal Menyimpan Coretan",
        message: err.message || "Gagal mengunggah dan menyimpan coretan PDF ke Google Drive.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handler Hapus Coretan Tahap Ini (Reset ke Gambar Asli)
  const handleResetStageCoretan = async () => {
    if (!existingStageCoretan || !renovasiId || !doc?.id) return;
    const confirmReset = window.confirm(
      `Apakah Anda yakin ingin menghapus berkas coretan tersimpan untuk Tahap ${stageInfo.label} dan mengulang dari lembar gambar asli yang bersih?`
    );
    if (!confirmReset) return;

    try {
      setSaving(true);
      const res = await fetch(
        `/api/dc-development/renovasi/${renovasiId}/dokumen/${doc.id}/coretan-pdf?coretan_id=${existingStageCoretan.id}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setExistingStageCoretan(null);
        setMyAnnotations({});
        setHistoryStack({});
        setRedoStack({});
        pdfDocCacheRef.current.delete(existingStageCoretan.id);
        if (doc?.id) {
          pdfDocCacheRef.current.delete(doc.id);
        }
        await loadLayers();
      }
    } catch (err: any) {
      console.error("Gagal mereset coretan:", err);
    } finally {
      setSaving(false);
    }
  };

  // Unduh dokumen PDF hasil coretan langsung ke komputer
  const handleDownloadSnapshot = async () => {
    try {
      setSaving(true);
      if (typeof activeLayerId === "number" && selectedRoleLayer) {
        const downloadUrl = `/api/dc-development/renovasi/${renovasiId}/dokumen/${selectedRoleLayer.id}/pdf-proxy?t=${Date.now()}`;
        const res = await fetch(downloadUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = selectedRoleLayer.nama_file || `Coretan_${selectedRoleLayer.id}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const pdfBlob = await generateAnnotatedPdfBlob();
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement("a");
        link.href = url;
        const cleanName = (doc?.nama_file || "Gambar.pdf").replace(/\.pdf$/i, "");
        link.download = `Coretan_${cleanName}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error("Gagal mengunduh PDF:", err);
      alert("Gagal mengunduh PDF coretan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Active layer metadata
  const selectedRoleLayer =
    typeof activeLayerId === "number"
      ? layers.find((l) => l.id === activeLayerId)
      : null;

  // Metadata per layer: nama peran pendek yang rapi dan penomoran urut per peran (Coretan 1, Coretan 2, dst)
  const layerMeta = useMemo(() => {
    const roleCounts: Record<string, number> = {};
    const map: Record<number, { roleShort: string; seqNumber: number; label: string; userInitial: string }> = {};

    layers.forEach((l) => {
      const roleShort = getShortRoleName(l.user_role, l.tahap_alur);
      roleCounts[roleShort] = (roleCounts[roleShort] || 0) + 1;
      const seq = roleCounts[roleShort];
      const userInitial = (l.user_nama || l.user_email || "Rev").split(" ")[0];
      const label = `${roleShort} • Coretan ${seq}`;

      map[l.id] = {
        roleShort,
        seqNumber: seq,
        label,
        userInitial,
      };
    });

    return { roleCounts, map };
  }, [layers]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[94vh] max-h-[94vh] overflow-hidden flex flex-col p-0 rounded-2xl border border-slate-300 shadow-2xl bg-white text-slate-800 [&>button:last-child]:hidden z-50">
        {/* 1. MAIN HEADER (Solid White, Clean Enterprise Border) */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-200 bg-white shrink-0 z-20">
          {/* File Info */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-[#E65F2B] shrink-0">
              <PenTool className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-xs font-bold text-slate-900 truncate max-w-sm" title={doc?.nama_file}>
                  {doc?.nama_file || "Gambar Kerja"}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {doc?.kategori_file?.includes("SIPIL") ? "Gambar Sipil" : "Gambar ME"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                SPARTA Architectural &amp; Engineering Drawing Review
              </p>
            </div>
          </div>

          {/* LAYER SWITCHER TABS (Clean Segmented Control dengan penomoran urut per peran) */}
          <div className="flex items-center bg-slate-100 border border-slate-200/90 rounded-xl p-1 gap-1 overflow-x-auto max-w-xl custom-scrollbar">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setActiveLayerId("MY_EDIT")}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0",
                  activeLayerId === "MY_EDIT"
                    ? "bg-[#E65F2B] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                )}
              >
                <PenTool className="w-3 h-3" />
                <span>
                  {existingStageCoretan
                    ? `Edit Coretan (${stageInfo.shortLabel})`
                    : `Coretan Baru (${stageInfo.shortLabel})`}
                </span>
                {!existingStageCoretan && (
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-white/20">
                    Coretan {(layerMeta.roleCounts[stageInfo.shortLabel] || 0) + 1}
                  </span>
                )}
              </button>
            )}

            {layers.map((l) => {
              const meta = layerMeta.map[l.id] || {
                roleShort: getShortRoleName(l.user_role, l.tahap_alur),
                seqNumber: 1,
                label: `${getShortRoleName(l.user_role, l.tahap_alur)} • Coretan 1`,
                userInitial: (l.user_nama || "Reviewer").split(" ")[0],
              };
              const isActive = activeLayerId === l.id;

              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setActiveLayerId(l.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0",
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  )}
                  title={`${l.nama_label || l.nama_file}\nOleh: ${l.user_nama} (${l.user_role})\nTanggal: ${new Date(l.created_at).toLocaleString("id-ID")}`}
                >
                  <History className="w-3 h-3 opacity-70" />
                  <span>{meta.roleShort}</span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-1.5 py-0.2 rounded",
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-blue-100/80 text-blue-700"
                    )}
                  >
                    Coretan {meta.seqNumber}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] px-1 py-0.2 rounded font-mono",
                      isActive ? "bg-black/20 text-white/90" : "bg-slate-200/80 text-slate-600"
                    )}
                  >
                    {meta.userInitial}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setActiveLayerId("CLEAN")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0",
                activeLayerId === "CLEAN"
                  ? "bg-slate-800 text-white shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
              )}
            >
              <span>Gambar Asli</span>
            </button>
          </div>

          {/* ZOOM & CLOSE CONTROLS */}
          <div className="flex items-center space-x-2 shrink-0">
            <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200 p-0.5">
              <button
                type="button"
                onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
                title="Perkecil Zoom"
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-semibold px-2 text-slate-700">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                title="Perbesar Zoom"
                className="p-1 hover:bg-white rounded text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setScale(1.2)}
                title="Reset Zoom (120%)"
                className="p-1 hover:bg-white rounded text-slate-500 hover:text-slate-900 transition-colors cursor-pointer border-l border-slate-200 ml-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDownloadSnapshot}
              className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer font-semibold flex items-center gap-1.5"
              title="Unduh snapshot gambar + coretan"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Unduh</span>
            </Button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. DOCKED SUB-HEADER TOOLBAR (Hanya tampil saat mode edit) */}
        {!isReadOnly && activeLayerId === "MY_EDIT" && existingStageCoretan && (
          <div className="bg-amber-50/90 border-b border-amber-200/90 px-5 py-2 flex items-center justify-between text-xs text-amber-950 shrink-0 z-10">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-bold">Mode Edit Coretan:</span>
              <span className="text-amber-900">
                Memperbarui coretan tersimpan Tahap <strong>{stageInfo.label}</strong>. Goresan baru akan ditambahkan pada lembar coretan tahap ini.
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetStageCoretan}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-100/70 border border-rose-200 px-2.5 py-0.5 rounded-lg cursor-pointer transition-colors"
              title="Hapus coretan tahap ini dari Drive dan ulangi dari gambar bersih"
            >
              Hapus &amp; Ulangi dari Gambar Asli
            </button>
          </div>
        )}

        {!isReadOnly && activeLayerId === "MY_EDIT" && !existingStageCoretan && (
          <div className="bg-blue-50/90 border-b border-blue-200/90 px-5 py-1.5 flex items-center justify-between text-xs text-blue-950 shrink-0 z-10">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="font-bold">
                Coretan Baru (Coretan {(layerMeta.roleCounts[stageInfo.shortLabel] || 0) + 1}):
              </span>
              <span className="text-blue-900">
                Membuat lembar coretan baru untuk Tahap <strong>{stageInfo.label}</strong> di atas PDF revisi terbaru pembuat.
              </span>
            </div>
            <span className="text-[11px] font-bold text-blue-700 bg-blue-100/80 border border-blue-200 px-2 py-0.5 rounded-full">
              {stageInfo.shortLabel} • Lembar Baru
            </span>
          </div>
        )}

        {activeLayerId === "CLEAN" && (
          <div className="bg-slate-100 border-b border-slate-200 px-5 py-1.5 flex items-center justify-between text-xs text-slate-700 shrink-0 z-10">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="font-bold">Gambar Asli Pembuat:</span>
              <span className="text-slate-600">Menampilkan gambar PDF awal yang diunggah oleh pembuat tanpa coretan review.</span>
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setActiveLayerId("MY_EDIT")}
                className="text-[11px] font-bold text-[#E65F2B] hover:text-[#d04f1f] bg-white border border-[#E65F2B]/30 hover:bg-orange-50 px-2.5 py-0.5 rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                ← Kembali ke Coretan Saya
              </button>
            )}
          </div>
        )}

        {!isReadOnly && activeLayerId === "MY_EDIT" && !loadingPdf && !pdfError && (
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-2 flex items-center justify-between text-xs shrink-0 z-10">
            <div className="flex items-center space-x-3">
              {/* Tools (Pena, Kotak, Teks, Penghapus) */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 space-x-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveTool("PEN")}
                  title="Pena Bebas (Freehand Draw)"
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === "PEN"
                      ? "bg-[#E65F2B] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Pena</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool("RECTANGLE")}
                  title="Kotak Pembatas Revisi (Bounding Box)"
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === "RECTANGLE"
                      ? "bg-[#E65F2B] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Kotak Revisi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool("TEXT")}
                  title="Catatan Teks / Label"
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === "TEXT"
                      ? "bg-[#E65F2B] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Teks</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool("ERASER")}
                  title="Penghapus Coretan"
                  className={cn(
                    "px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                    activeTool === "ERASER"
                      ? "bg-[#E65F2B] text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Penghapus</span>
                </button>
              </div>

              {/* Separator */}
              <div className="h-5 w-px bg-slate-300" />

              {/* Architectural Colors */}
              <div className="flex items-center space-x-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Tinta:</span>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setActiveColor(c.value)}
                    title={c.name}
                    className={cn(
                      "w-5 h-5 rounded-full transition-transform cursor-pointer flex items-center justify-center",
                      activeColor === c.value ? "ring-2 ring-slate-800 scale-110" : "opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c.value }}
                  >
                    {activeColor === c.value && <Check className="w-2.5 h-2.5 text-white drop-shadow-xs" />}
                  </button>
                ))}
              </div>

              {/* Line Width */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 space-x-0.5 shadow-2xs">
                {LINE_WIDTHS.map((lw) => (
                  <button
                    key={lw.value}
                    type="button"
                    onClick={() => setActiveLineWidth(lw.value)}
                    className={cn(
                      "px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer",
                      activeLineWidth === lw.value
                        ? "bg-slate-800 text-white font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    {lw.label}
                  </button>
                ))}
              </div>

              {/* Separator */}
              <div className="h-5 w-px bg-slate-300" />

              {/* Undo / Redo / Clear */}
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={handleUndo}
                  title="Undo (Ctrl+Z)"
                  disabled={(historyStack[currentPage] || []).length === 0}
                  className="px-2 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer flex items-center gap-1 font-medium text-xs"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline text-[11px]">Undo (Ctrl+Z)</span>
                </button>

                <button
                  type="button"
                  onClick={handleRedo}
                  title="Redo (Ctrl+Y)"
                  disabled={(redoStack[currentPage] || []).length === 0}
                  className="px-2 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer flex items-center gap-1 font-medium text-xs"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline text-[11px]">Redo (Ctrl+Y)</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearPage}
                  title="Hapus Semua Coretan di Halaman Ini"
                  className="p-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 bg-white transition-colors cursor-pointer shadow-2xs ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Status text */}
            <div className="text-[11px] font-medium text-slate-500">
              <span className="font-bold text-slate-800">{myAnnotations[currentPage]?.length || 0}</span> coretan pada halaman ini
            </div>
          </div>
        )}

        {/* 3. REVIEWER HIGHLIGHT BANNER */}
        {selectedRoleLayer ? (
          <div className="bg-blue-50/90 border-b border-blue-200 px-5 py-2 flex items-center justify-between text-xs text-blue-900 shrink-0 z-10">
            <div className="flex items-center space-x-2.5">
              <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {(selectedRoleLayer.user_nama || "R").charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="font-bold text-slate-900">
                  {selectedRoleLayer.user_nama || "Reviewer"}
                </span>{" "}
                <span className="text-[10px] font-extrabold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 uppercase">
                  {selectedRoleLayer.user_role || "REVIEWER"}
                </span>
                <span className="text-slate-500 ml-2">
                  Status:{" "}
                  <strong
                    className={
                      selectedRoleLayer.status_aksi === "REVISI"
                        ? "text-amber-700"
                        : selectedRoleLayer.status_aksi === "TOLAK"
                        ? "text-rose-700"
                        : "text-emerald-700"
                    }
                  >
                    {selectedRoleLayer.status_aksi}
                  </strong>{" "}
                  pada{" "}
                  {new Date(selectedRoleLayer.updated_at).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setActiveLayerId("MY_EDIT")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-bold shadow-2xs transition-colors shrink-0 cursor-pointer"
                >
                  <span>← Kembali ke Coretan Saya</span>
                </button>
              )}
              {selectedRoleLayer.file_url && (
                <a
                  href={selectedRoleLayer.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#E65F2B] hover:bg-[#d04f1f] text-white text-xs font-bold shadow-2xs transition-colors shrink-0"
                >
                  <span>Buka di Google Drive</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {selectedRoleLayer.catatan && (
                <p className="text-[11px] italic text-slate-700 max-w-md truncate bg-white px-2.5 py-1 rounded border border-blue-200/60 shadow-2xs">
                  &ldquo;{selectedRoleLayer.catatan}&rdquo;
                </p>
              )}
            </div>
          </div>
        ) : null}

        {/* 4. WORKSPACE AREA (Scrollable Canvas Container - Top Scroll Fixed) */}
        <div className="flex-1 overflow-auto bg-slate-200/75 relative p-6 md:p-8 flex flex-col items-center min-h-0 custom-scrollbar">
          {loadingPdf && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center space-y-3 bg-slate-100/90 text-slate-600">
              <Loader2 className="w-8 h-8 animate-spin text-[#E65F2B]" />
              <p className="text-xs font-semibold tracking-wide text-slate-700">
                Membaca dan memproses lembar berkas PDF...
              </p>
            </div>
          )}

          {pdfError ? (
            <div className="m-auto flex flex-col items-center justify-center p-8 bg-white border border-rose-200 rounded-2xl max-w-md text-center shadow-md z-10">
              <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
              <h4 className="text-sm font-bold text-slate-900">Gagal Menampilkan Lembar PDF</h4>
              <p className="text-xs text-rose-600 mt-1">{pdfError}</p>
            </div>
          ) : (
            <div
              className={cn(
                "m-auto shrink-0 relative bg-white shadow-xl border border-slate-300 rounded-sm select-none transition-opacity",
                loadingPdf ? "opacity-0 pointer-events-none" : "opacity-100"
              )}
              style={{
                width: pageSize.width > 0 ? pageSize.width : (bgCanvasRef.current?.width || "auto"),
                height: pageSize.height > 0 ? pageSize.height : (bgCanvasRef.current?.height || "auto"),
              }}
            >
              {/* PDF Background Canvas */}
              <canvas
                ref={bgCanvasRef}
                className="block pointer-events-none"
              />

              {/* Interactive Overlay Drawing Canvas */}
              <canvas
                ref={drawCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={cn(
                  "absolute inset-0 z-10",
                  isReadOnly || activeLayerId !== "MY_EDIT"
                    ? "cursor-default"
                    : activeTool === "PEN"
                    ? "cursor-crosshair"
                    : activeTool === "RECTANGLE"
                    ? "cursor-crosshair"
                    : activeTool === "TEXT"
                    ? "cursor-text"
                    : "cursor-pointer"
                )}
              />

              {/* Inline Text Prompt Input if user clicked Text Tool */}
              {textPromptPos && (
                <div
                  className="absolute z-30 p-2.5 rounded-xl bg-white border border-slate-300 shadow-2xl flex items-center space-x-2"
                  style={{
                    left: `${textPromptPos.x}px`,
                    top: `${textPromptPos.y}px`,
                  }}
                >
                  <Input
                    autoFocus
                    placeholder="Ketik catatan revisi di sini..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddText();
                      if (e.key === "Escape") setTextPromptPos(null);
                    }}
                    className="h-8 text-xs bg-slate-50 border-slate-300 text-slate-800 w-64 rounded-lg"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddText}
                    className="h-8 px-2.5 bg-[#E65F2B] hover:bg-[#cf4d1a] text-white text-xs rounded-lg font-bold"
                  >
                    Pasang
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTextPromptPos(null)}
                    className="h-8 px-2 text-slate-500 hover:text-slate-800 text-xs"
                  >
                    Batal
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. FOOTER BAR (Solid White, Clean Border) */}
        <div className="flex items-center justify-between px-6 py-2.5 border-t border-slate-200 bg-white shrink-0 z-20">
          {/* Page Navigator */}
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loadingPdf}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2.5 border-slate-200 text-slate-700 bg-white hover:bg-slate-100 rounded-lg cursor-pointer text-xs font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Sebelumnya
            </Button>
            <span className="text-xs text-slate-600 font-mono px-2">
              Halaman <strong>{currentPage}</strong> dari <strong>{numPages || 1}</strong>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= numPages || loadingPdf}
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              className="h-8 px-2.5 border-slate-200 text-slate-700 bg-white hover:bg-slate-100 rounded-lg cursor-pointer text-xs font-semibold"
            >
              Selanjutnya
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            {!isReadOnly ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-8.5 px-3.5 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl cursor-pointer text-xs font-semibold"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={handleSave}
                  className="h-8.5 px-4 bg-[#E65F2B] hover:bg-[#cf4d1a] text-white rounded-xl shadow-xs cursor-pointer text-xs font-bold transition-all"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Menyimpan...
                    </>
                  ) : existingStageCoretan ? (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Perbarui Coretan (Tahap {stageInfo.shortLabel})
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      Simpan Coretan (Tahap {stageInfo.shortLabel})
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8.5 px-4 border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer text-xs font-bold"
              >
                Tutup
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Feedback Modal Pop-up Visual */}
    {feedbackModal.open && (
      <FeedbackModal
        open={feedbackModal.open}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onClose={handleCloseFeedback}
      />
    )}
  </>
  );
}
