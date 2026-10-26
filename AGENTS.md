<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SPARTA DC-Development — Mandatory Component Reuse & Architecture Rules

## MANDATORY: Always Follow Architecture Guidelines
1. **Read Full Guidelines**: Always consult [GEMINI.md](file:///c:/alfamart/KERJA/DC-Development/GEMINI.md) for detailed workflows on creating new features, navigation registration, document catalogs, approval flows, and complete component catalogs.
2. **Component Reuse First & No Duplication**: Before writing any new UI, check `components/` for existing components. Never duplicate existing UI components.
3. **Reusable Component Extraction**: If an element has potential to be reused across modules, extract it into `components/<module>/` or `components/ui/` with typed configurable props.
4. **Navigation Registration**: Every new main feature menu MUST be registered in `dcMenus` in `components/dashboard/menu-navigasi.tsx` (which automatically integrates into `manajemen-user`).
5. **Daftar Dokumen Integration**: If a feature has official PDF documents/archives, register a card in `app/dc-development/daftar-dokumen/page.tsx` and build the catalog page using `DokumenHeaderCard`, `DokumenFilterToolbar`, and a catalog table.
6. **Approval Workflow Integration**: If a feature involves approvals, register a card in `app/dc-development/approval/page.tsx`, use `ApprovalPageTitle`, `ApprovalFilterToolbar`, `ApprovalStepper`, `ApprovalNotesHistory` (collapsible, default closed), `ApprovalActionCard`, `ApprovalActionDialog` (mandatory note on revision), and always trigger `FeedbackModal` (`components/ui/feedback-modal.tsx`).
7. **Revision & Tiered Visibility Rules**: Status `REVISI` is strictly private to creator (`created_by === user.email`) and Admin (hidden from approver queues; detail/PDF buttons hidden on revision rows; edit form requires modifying >= 1 field). Approver queues strictly enforce tiered hierarchy and user `coverage_cabang`.
8. **SPARTA Design Tokens**: Radius `rounded-2xl`, border `border-slate-200/80`, brand orange accent `#E65F2B`, clean typography, background `#FAFAFA`.
