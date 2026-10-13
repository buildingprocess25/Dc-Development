export interface ApprovalNoteItem {
  id: string;
  action: "PENGAJUAN" | "APPROVE" | "REVISI" | "TOLAK" | "CATATAN";
  author: string;
  role?: string;
  date: string;
  note: string;
}

/**
 * Mem-parsing string riwayat catatan (catatan_pengajuan) menjadi daftar objek ApprovalNoteItem yang terstruktur.
 */
export function parseApprovalNotes(
  text?: string | null,
  defaultAuthor?: string,
  defaultDate?: string | Date
): ApprovalNoteItem[] {
  if (!text || !text.trim()) return [];

  const raw = text.trim();
  const items: ApprovalNoteItem[] = [];

  // Pola regex toleran terhadap huruf besar/kecil:
  // [ACTION oleh AUTHOR_AND_ROLE (TANGGAL)]: CATATAN
  const regex = /\[(APPROVE|REVISI|TOLAK|CATATAN)\s+oleh\s+([^()[\]]+?)\s*\(([^()]+)\)\]:\s*([\s\S]*?)(?=(?:\n*\[(?:APPROVE|REVISI|TOLAK|CATATAN)\s+oleh|$))/gi;

  let counter = 1;

  // Cek apakah ada catatan awal pengajuan sebelum log pertama
  const firstBracket = raw.indexOf("[");
  if (firstBracket > 0) {
    const initialNote = raw.substring(0, firstBracket).trim();
    if (initialNote) {
      let formattedDate = "-";
      if (defaultDate) {
        if (typeof defaultDate === "string") {
          formattedDate = defaultDate;
        } else {
          formattedDate = defaultDate.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric"
          });
        }
      }

      items.push({
        id: `note-initial-${counter++}`,
        action: "PENGAJUAN",
        author: defaultAuthor || "Pembuat Pengajuan",
        role: "Branch Building Koordinator",
        date: formattedDate,
        note: initialNote
      });
    }
  } else if (firstBracket === -1 && raw) {
    let formattedDate = "-";
    if (defaultDate) {
      if (typeof defaultDate === "string") {
        formattedDate = defaultDate;
      } else {
        formattedDate = defaultDate.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
      }
    }

    items.push({
      id: `note-initial-${counter++}`,
      action: "PENGAJUAN",
      author: defaultAuthor || "Pembuat Pengajuan",
      role: "Branch Building Koordinator",
      date: formattedDate,
      note: raw
    });
    return items;
  }

  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    const rawAction = match[1].toUpperCase() as any;
    const authorAndRole = (match[2] || "").trim();
    const dateRaw = (match[3] || "").trim();
    const noteContent = (match[4] || "").trim();

    let author = authorAndRole;
    let role: string | undefined = undefined;

    if (authorAndRole.includes(" - ")) {
      const parts = authorAndRole.split(/\s+-\s+/);
      author = parts[0]?.trim() || "Peninjau";
      role = parts.slice(1).join(" - ").trim();
    }

    items.push({
      id: `note-log-${counter++}`,
      action: rawAction === "REVISI" || rawAction === "APPROVE" || rawAction === "TOLAK" ? rawAction : "CATATAN",
      author,
      role,
      date: dateRaw || "-",
      note: noteContent
    });
  }

  return items;
}

/**
 * Mengambil HANYA catatan berstatus REVISI (instruksi perbaikan)
 */
export function getRevisionNotes(
  text?: string | null,
  defaultAuthor?: string,
  defaultDate?: string | Date
): ApprovalNoteItem[] {
  return parseApprovalNotes(text, defaultAuthor, defaultDate).filter((item) => item.action === "REVISI");
}

/**
 * Mengambil HANYA catatan berstatus APPROVE (catatan persetujuan peninjau)
 */
export function getApprovalNotes(
  text?: string | null,
  defaultAuthor?: string,
  defaultDate?: string | Date
): ApprovalNoteItem[] {
  return parseApprovalNotes(text, defaultAuthor, defaultDate).filter((item) => item.action === "APPROVE");
}

/**
 * Mengecek apakah pengajuan memiliki catatan persetujuan (APPROVE) terdahulu.
 */
export function hasPreviousApprovalNotes(text?: string | null): boolean {
  if (!text || !text.trim()) return false;
  const regex = /\[(?:APPROVE|Approve)\s+(?:oleh|Oleh)/i;
  return regex.test(text);
}

/**
 * Mengecek apakah pengajuan memiliki catatan permintaan revisi (REVISI) terdahulu.
 */
export function hasPreviousRevisionNotes(text?: string | null): boolean {
  if (!text || !text.trim()) return false;
  const regex = /\[(?:REVISI|Revisi)\s+(?:oleh|Oleh)/i;
  return regex.test(text);
}
