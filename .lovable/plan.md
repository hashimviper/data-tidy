## Overview

Build a new local-first, AI-powered data workspace UI called **[YOUR APP NAME]** (placeholder — we'll ask you for the final name) on top of the existing React + Vite + Tailwind + shadcn project. This phase is **frontend-only**: polished UI, realistic mock data, central store, ready for a real backend to slot in later.

The existing single-page cleaning tool (`src/pages/Index.tsx`) and its libs will be **preserved but moved** under a legacy route (`/legacy-cleaner`) so nothing you already built is lost, while the new multi-workspace app becomes the default experience.

## App Shell

- **Layout**: `SidebarProvider` shell with collapsible left sidebar, top bar (breadcrumbs, theme toggle, Cmd/Ctrl+K trigger, dataset switcher), and a right-side **dockable AI Copilot panel** (collapsible, resizable).
- **Command Palette** (`cmdk`): Cmd/Ctrl+K opens quick actions (switch workspace, new dataset, run transform, ask AI).
- **Theme**: dark + light toggle, glass accents only on modals/AI panel/command palette.
- **Routing** (React Router, already installed):
  - `/` → Project Dashboard
  - `/upload` → Upload
  - `/datasets/:id/profile`
  - `/datasets/:id/clean`
  - `/datasets/:id/eda`
  - `/datasets/:id/dashboard`
  - `/datasets/:id/ml`
  - `/datasets/:id/reports`
  - `/settings`
  - `/legacy-cleaner` (existing tool preserved)

## Workspaces (all with mock data + empty/loading/skeleton states)

1. **Project Dashboard** — dataset cards (name, last modified, rows×cols, quality-score ring badge), "New Dataset" CTA, recent activity feed.
2. **Upload** — drag-drop zone, format chips (CSV/Excel/JSON/TSV/Parquet), mocked upload progress → redirect to Profile.
3. **Profiling** — summary cards, quality-score ring, column table with expand rows (mini distribution chart, stats), correlation heatmap (mock), Data Quality Issues list with severity chips + "Fix with AI" buttons.
4. **Cleaning & Transformation** — 3-column layout: pipeline step list (left, editable/removable, undo/redo), spreadsheet-like data grid (center, sort/filter/edit), transformation toolbox (right, collapsible categories: Cleaning / Transform / Encode-Scale), formula builder modal for calculated columns.
5. **AI Copilot** (global dockable panel) — chat UI, response cards with `{explanation, code (Python/Pandas/SQL tabs), chartSpec?}`, "Apply to pipeline" button, suggested prompt chips.
6. **EDA** — chart type picker + column selectors, chart gallery (histogram/box/scatter/bar/line/heatmap using `recharts`), Auto-Insights bullet panel, pair-plot placeholder.
7. **Dashboard Builder** — grid canvas with draggable/resizable widgets (`react-grid-layout`), widget sidebar (KPI, bar, line, pie, table, gauge, map placeholder), theme picker, Save/Export buttons (UI only).
8. **ML Workspace** — model type selector, target + feature checklist, mocked train progress → metrics cards + feature importance bar + plain-English explanation, model comparison table.
9. **Reports Center** — report cards, preview pane (Exec Summary / Key Findings / Charts / Recommendations), export buttons (UI only).
10. **Settings** — theme, local storage folder path input, about/version.

## Reusable Components

`QualityRing`, `DataGrid` (virtualized via `@tanstack/react-virtual`), `PipelineStepCard`, `ChatMessage` (with fenced-code rendering), `ChartCard` wrapper, `EmptyState`, `SkeletonBlock`, `SeverityBadge`, `FormatIcon`.

## State Architecture (backend-ready)

Central **Zustand** store (`src/store/workspace.ts`):

```ts
type PipelineStep = { id: string; type: string; params: Record<string, unknown>; createdAt: string };
type Dataset = { id; name; rows; columns; schema; quality; pipeline: PipelineStep[]; issues; createdAt; updatedAt };
type AiMessage = { id; role; text; response?: { explanation; code: {python; pandas; sql}; chartSpec? } };
type WorkspaceState = { datasets; activeDatasetId; aiMessages; theme; copilotDocked; ... };
```

- All workspace pages read/write through the store — no component owns raw data.
- Pipeline steps are serializable `{type, params}` so a real engine drops in later.
- Mock data seeded in `src/lib/mockData.ts` (sales, HR, finance sample datasets).
- A thin `dataService` interface (`getDataset`, `applyStep`, `askAi`) wraps mock impls today; swap for real backend later without touching UI.

## Dependencies to add

`zustand`, `cmdk`, `react-grid-layout` (+ types), `@tanstack/react-virtual`, `react-markdown` (for AI chat code blocks). Charts use existing `recharts`. Drag-and-drop uses `@dnd-kit` (already in shadcn stack via sidebar? if not, add `@dnd-kit/core`).

## Out of Scope (per your list)

Real parsing, real transforms, real AI calls, real ML training, real exports, auth, cloud storage, streaming.

## Two quick questions before I build

1. **App name** — you wrote `DataTidy`. What should it actually be called?
2. **Preserve existing cleaner?** — I plan to keep your current cleaning tool at `/legacy-cleaner` so nothing is lost. OK, or should I remove it entirely?  
no you can keep the existing but i need to enhance the tool for world class production ready tool