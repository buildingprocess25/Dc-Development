export interface AnnotationPoint {
  x: number;
  y: number;
}

export type AnnotationTool = "PEN" | "RECTANGLE" | "TEXT" | "ERASER";

export interface AnnotationObject {
  id: string;
  tool: AnnotationTool;
  color: string;
  lineWidth: number;
  points?: AnnotationPoint[];
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text?: {
    x: number;
    y: number;
    content: string;
    fontSize: number;
  };
}

export interface PageAnnotation {
  pageIndex: number;
  width: number;
  height: number;
  objects: AnnotationObject[];
}

export interface DocumentAnnotationPayload {
  pages: PageAnnotation[];
}

export interface RoleAnnotationLayer {
  id: number;
  dokumen_id: number;
  user_email: string;
  user_nama: string;
  user_role: string;
  status_aksi: string;
  catatan?: string | null;
  file_url?: string | null;
  drive_file_id?: string | null;
  nama_file?: string | null;
  nama_label?: string | null;
  tahap_alur?: string | null;
  anotasi_json?: DocumentAnnotationPayload | null;
  created_at: string;
  updated_at: string;
}

