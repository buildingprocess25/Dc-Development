import { API_URL } from "./constants";
import { safeFetchJSON, apiFetch } from "./api";

// TYPES

export interface DcArchiveProject {
  id: number;
  project_id?: number;
  archive_code: string;
  archive_name: string;
  branch_name: string;
  location_name?: string;
  project_type: string;
  archive_type: string;
  address?: string;
  notes?: string;
  parent_dc_code?: string;
  parent_dc_name?: string;
  parent_branch_name?: string;
  created_at: string;
  updated_at: string;
  
  // Custom frontend fields mapped from docs
  docs_pembangunan?: number;
  docs_renovasi?: number;
  docs_perluasan?: number;
  custom_items_pembangunan?: number;
  custom_items_renovasi?: number;
  custom_items_perluasan?: number;
}

export interface DcDocument {
  id: number;
  project_id?: number;
  tender_id?: number;
  entity_type: string;
  entity_id?: number;
  document_type: string;
  stage: string;
  status: string;
  created_at: string;
  
  versions?: DcDocumentVersion[];
  
  // Joined fields
  file_name?: string;
  link_dokumen?: string;
}

export interface DcDocumentVersion {
  id: number;
  document_id: number;
  version_no: number;
  file_name: string;
  mime_type: string;
  link_dokumen: string;
  notes?: string;
  uploaded_by_email: string;
  is_current: boolean;
  created_at: string;
}

// API FUNCTIONS

export const fetchDcArchiveProjects = async (): Promise<DcArchiveProject[]> => {
  const result = await safeFetchJSON(`/api/dc-development/archive-projects`);
  return result.data || [];
};

export const fetchDcDocuments = async (archiveProjectId: number): Promise<DcDocument[]> => {
  const result = await safeFetchJSON(`${API_URL}/api/dc-development/documents?entityType=DC_ARCHIVE_PROJECT&projectId=${archiveProjectId}`);
  return result.data || [];
};

// You can also add more endpoints later like export, create, etc.
