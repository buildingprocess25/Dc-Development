<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SPARTA DC-Development — Mandatory Component Reuse Rules

## MANDATORY: Always Reuse Existing Components First
1. **Never Duplicate Components**: Before creating any new UI, page, or feature, you MUST check `components/` for existing reusable components.
2. **Reuse Existing Catalog**:
   - **Hub / Landing Pages**: Use `HubHeaderBanner` and `HubCategoryCard` from `components/hub/`.
   - **Approval Modules**: Use `ApprovalPageTitle` and `ApprovalFilterToolbar` from `components/approval/`.
   - **Document Catalog Modules**: Use `DokumenHeaderCard` and `DokumenFilterToolbar` from `components/dokumen/`.
   - **Branch & Filter Dropdowns**: Always use `BranchFilterSelect` (`components/ui/branch-filter-select.tsx`) and `FilterSelect` (`components/ui/filter-select.tsx`).
3. **Only Create New Components When None Exist**: If a feature requires UI that does not exist anywhere in the codebase, build it as a reusable, modular component under `components/<module>/` with configurable props so other features can consume it in the future.
4. **Follow SPARTA Design Tokens**: Radius `rounded-2xl`, border `border-slate-200/80`, brand orange accent `#E65F2B`, clean typography.
