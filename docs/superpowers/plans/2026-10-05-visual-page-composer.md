# Visual Page Composer Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. User asked to continue through the finished result, so do not pause for an additional plan approval.

**Goal:** Replace the split admin page Structure/Content dialogs with a single intuitive staged visual composer for all generic section pages.

**Architecture:** Add a pure page-composer model for section ordering, default pointers, field keys, and persistence payloads; build one client workspace using the existing Supabase RPCs, media picker, rich text editor, and preview renderer; expose it from `AdminLiveEditor` only for pages rendered from `page_sections`. Lessons and Book keep their specialized UI.

**Tech stack:** Next.js 16, React 19, TypeScript, MUI, Supabase JS/RPC, Node test runner through `tsx`, Playwright for browser verification.

## Task 1: Model staged section edits and defaults

**Files:** `lib/pageComposerModel.ts`, `tests/page-composer-model.test.ts`

- [x] Write tests for moving a section in either direction, including boundaries and no input mutation.
- [x] Write tests for creating and duplicating each supported kind with stable unique ids and safe default content/media pointers.
- [x] Write tests that derive Hero/Rich Text/Media CMS keys and media prefixes from preserved pointers or defaults.
- [x] Run `node --import tsx --test tests/page-composer-model.test.ts` and confirm each new behavior fails for the expected missing export.
- [x] Implement only the tested pure helpers: ordering, section creation/duplication, pointer defaults, preview-field key derivation, and ordered RPC payload construction. Preserve existing section `content_source`, `media_source`, `meta`, and anchor values.
- [x] Rerun the focused test and confirm it passes.

## Task 2: Build the staged visual workspace

**Files:** `components/admin/VisualPageComposer.tsx`, `components/admin/MediaPickerDialog.tsx` (read-only use), `components/admin/RichText/*` (read-only use), `lib/pageComposerModel.ts`

- [x] Add a page load test or extract/test a pure dirty-draft transition used by the workspace before adding UI behavior.
- [x] Implement guarded loading of `rpc_get_page_sections`, linked CMS values (`admin_get_cms_page_row`), and referenced media slots/signed previews. Cancel stale async results if the selected page changes.
- [x] Add one workspace with a top bar, section outline, viewport-framed live preview, and selected-section inspector.
- [x] Implement staged add, duplicate, delete, drag reorder, and keyboard/mouse Move up / Move down. Provide undo for the latest structural action and a discard confirmation when changes are dirty.
- [x] Add locale-aware Hero and Rich Text inputs; Hero CTA labels/URLs; Hero and Media asset controls and media carousel add/reorder/remove; Card Group source selector; and collapsed advanced anchor/metadata fields.
- [x] Keep inspector, preview, and outline synchronized from one draft state. New/deleted sections must not invoke write RPCs before Save.
- [x] Implement one Save action that writes ordered sections and dirty content/media with existing RPCs, keeps all drafts on any error, explains partial persistence without claiming atomicity, and supports retry.

## Task 3: Make preview selection and staged values live

**Files:** `components/sections/PagePreviewRenderer.tsx`, `components/admin/VisualPageComposer.tsx`, `tests/page-composer-model.test.ts`

- [x] Add tests for selected-section selection/reorder mapping in the pure model if helper behavior is needed.
- [x] Add `onSelectSection` and selected-section presentation to the preview renderer without changing its public rendering behavior when those props are omitted.
- [x] Show clear clickable section boundaries, keep preview links/media controls from navigating away, and render staged bilingual text/media values immediately.
- [x] Replace the current Card Group placeholder with the existing card-group renderer or an equivalent accurate read-only preview using its configured source.

## Task 4: Integrate by page type

**Files:** `components/admin/AdminLiveEditor.tsx`, `components/admin/adminPages.ts` if a shared registry is appropriate

- [x] Replace Structure/Content mode tabs and dialogs with the visual composer on generic section pages.
- [x] Keep the specialized Lessons/Book editors and Gallery media-slot editor visible and reachable.
- [x] Add a clear fallback for any page that does not use the generic section renderer.
- [x] Verify locale/page changes cannot carry dirty state into the next page.

## Task 5: Verify the full interaction flow

**Files:** `tests/page-composer-model.test.ts`, relevant existing tests; no production content changes

- [x] Run focused composer tests and the full `npm test` suite (11/11 focused; 71/71 total).
- [x] Run `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:public`. Lint reported 0 errors (41 existing warnings); TypeScript passed. Next compiled and generated all 46 pages, then the npm wrapper returned `ENOSPC` while writing its log. The public-rendering script passed directly for all 18 locale routes plus sitemap and robots.
- [ ] Run the full authenticated composer click-through on a local/test environment. Local dev server and public Home route loaded; admin navigation correctly stopped at sign-in. This worktree has no Supabase URL/key or safe test target, so the actual editor interactions could not be exercised without using production credentials or data.
- [x] Review the final diff for unauthorized writes, pointer loss, stale async updates, navigation regressions, and responsive/keyboard controls. Added regression coverage for preview reorder synchronization and stale metadata errors from deleted sections.
- [x] Record the browser/build limits above; no production content, database schema, deployment, or remote branch was changed.

## Execution ledger

- Ruling: `main/visual-page-composer` could not be created because the existing local `main` branch blocks a `main/...` ref path; use `main-visual-page-composer` — preserves the requested branch prefix while avoiding ref namespace collision — cost if wrong: branch naming differs from the slash style only.
- Ruling: use existing two admin RPCs with retained drafts and explicit partial-save recovery instead of adding a database migration — avoids a live schema dependency for the editor feature — cost if wrong: a failed second RPC can leave one part already saved, clearly surfaced for retry.

