# Visual Page Composer Design

## Goal

Replace the separate Structure and Content dialogs with one visual workspace that a nontechnical administrator can use to rearrange, edit, add, duplicate, and remove page sections while seeing the staged result before saving.

## User and success criteria

The primary user is the Sunset Surf Academy administrator, who wants to make routine page changes without understanding section IDs, content keys, JSON, or database behavior.

The feature succeeds when the administrator can:

1. See the page as a live preview with each editable section visibly selectable.
2. Rearrange sections by dragging, with clear Move up / Move down controls available to mouse, keyboard, and touch users.
3. Select a section and make its supported text, link, image/video, and advanced settings changes in one place.
4. Add, duplicate, or remove the existing supported section types without writing to the site before Save.
5. switch between English and Spanish drafts and see each locale's preview.
6. Save or discard the staged page changes with a clear status and useful recovery message if one part of persistence fails.

## Workspace layout

- **Top bar:** page name, locale switch, desktop/tablet/mobile preview size, unsaved indicator, Discard, and Save changes.
- **Section outline:** friendly names and block icons; selected section is highlighted. Drag handles, accessible move buttons, Duplicate, and Delete actions live here. Add section opens a small menu with the existing Hero, Text, Media, and Card group types.
- **Live preview:** renders staged content and media using the same preview renderer as the public section system. Clicking a section selects it in the outline and inspector. The selected section gets a clear editor outline without changing its content.
- **Inspector:** shows a short, type-specific form for the selected section. Labels use ordinary language. Rich text continues to use the existing rich text editor; image and video selection uses the existing media picker. An Advanced settings disclosure retains anchor and metadata editing for cases that need it.

## V1 scope

The composer supports pages already rendered from `page_sections`: Home, About Jaz, Gallery, Team, FAQ, Mission Statement, and Contact. It supports the existing section kinds: Hero, Rich Text, Media, and Card Group. Lessons and Book keep their specialized editors because their layouts and booking behavior are not driven by the generic section renderer. Gallery's existing gallery-slot manager remains available alongside the composer.

Existing capabilities remain available: English and Spanish text drafts, hero title/subtitle and both CTA labels/links, rich text, hero/background and media slots, media carousels, section order, add/delete, anchors, and advanced section metadata. Card Group source selection is available in its inspector; advanced metadata remains in the collapsed settings. New block kinds and arbitrary free-form page layout are not part of V1.

## Editing and save behavior

- All visible edits are local drafts until the administrator chooses Save changes. Add, duplicate, move, delete, inline selection, and inspector editing never issue writes by themselves.
- Preview content and media are derived from the same draft state as the inspector, so edits appear immediately.
- Save persists the ordered section bundle and then the dirty bilingual content/media bundle using the existing admin RPCs. If either request fails, keep every draft in the editor, show which part saved and which part needs retry, and make retry idempotent. Never clear the draft merely because one request succeeded. This V1 flow is recoverable but is not a single database transaction.
- Discard reloads the latest server state and confirms before dropping dirty changes.
- A successful save refreshes the authoritative section/content/media data and clears the unsaved indicator.
- Loading, authentication errors, save failures, empty pages, and unsupported data have explicit nontechnical messages. A network/auth failure never silently closes the workspace.

## Accessibility and responsive behavior

- Every drag action has keyboard-operable Move up / Move down buttons and announces reorder results to assistive technology.
- Section selection, Add, Duplicate, Delete, locale, viewport, Discard, and Save controls have accessible names and visible focus states.
- At desktop width, the outline, preview, and inspector appear side by side. At tablet width, the inspector can collapse or stack below the preview. At narrow widths, panels stack in a clear Outline → Preview → Edit order and actions remain reachable without horizontal overflow.

## Acceptance checks

- Existing admin page boundaries and supported section kinds are explicit in the UI.
- Drag and keyboard reordering produce the same order, without mutating the original loaded list.
- New, duplicated, edited, and deleted sections remain draft-only until Save.
- Preview values reflect English/Spanish text and media drafts before saving.
- Save includes the complete final section list, preserves content/media pointers, and retains drafts on partial or total failure.
- Discard reloads from the backend only after an explicit confirmation when drafts exist.
- Existing booking, Lessons, Book, and gallery-specific admin flows remain reachable and function as before.
- Type checks, tests, lint, production build, and a browser click-through cover the editor's main route and interactions.

## Risks and mitigations

- **Two existing RPCs are needed for layout and content/media.** Save them in a controlled sequence, report partial persistence precisely, retain the whole draft, and permit safe retries. Do not claim a transactional save.
- **A future unsupported block could otherwise be lost during save.** Refuse to open an editable workspace when an unknown section type is present; preserve it for a future supported editor.
- **Many sections or slow media reads can make the editor feel frozen.** Load the page in explicit loading states, guard asynchronous responses when the page changes, and keep controls disabled only while the corresponding request is active.
- **Raw metadata can be confusing or invalid.** Keep it in a collapsed Advanced settings area, validate before saving, and keep a clear error beside the field.

