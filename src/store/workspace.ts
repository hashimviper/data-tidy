import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { seedDatasets, type SeedDataset } from '@/lib/mockData';

export type PipelineStep = {
  id: string;
  type: string;
  label: string;
  params: Record<string, unknown>;
  createdAt: string;
};

export type ColumnSchema = {
  name: string;
  type: 'numeric' | 'categorical' | 'date' | 'boolean' | 'text';
  nullPct: number;
  unique: number;
  samples: unknown[];
  min?: number;
  max?: number;
  mean?: number;
};

export type QualityIssue = {
  id: string;
  column?: string;
  type: 'missing' | 'duplicate' | 'invalid' | 'outlier' | 'format';
  severity: 'low' | 'medium' | 'high' | 'critical';
  count: number;
  message: string;
};

export type Dataset = {
  id: string;
  name: string;
  format: 'csv' | 'xlsx' | 'json' | 'tsv' | 'parquet';
  rowCount: number;
  colCount: number;
  quality: number; // 0-100
  createdAt: string;
  updatedAt: string;
  schema: ColumnSchema[];
  rows: Record<string, unknown>[];
  pipeline: PipelineStep[];
  redoStack: PipelineStep[];
  issues: QualityIssue[];
};

export type AiCodeBlock = { python: string; pandas: string; sql: string };
export type AiResponse = { explanation: string; code: AiCodeBlock; chartSpec?: Record<string, unknown> };
export type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AiResponse;
  createdAt: string;
};

type Store = {
  datasets: Dataset[];
  activeDatasetId: string | null;
  aiMessages: AiMessage[];
  copilotDocked: boolean;
  copilotOpen: boolean;
  commandOpen: boolean;
  activity: { id: string; text: string; at: string }[];
  storagePath: string;

  setActiveDataset: (id: string | null) => void;
  addDataset: (d: Dataset) => void;
  removeDataset: (id: string) => void;
  addStep: (datasetId: string, step: PipelineStep) => void;
  removeStep: (datasetId: string, stepId: string) => void;
  undoStep: (datasetId: string) => void;
  redoStep: (datasetId: string) => void;
  addAiMessage: (m: AiMessage) => void;
  clearAiMessages: () => void;
  toggleCopilot: () => void;
  setCopilotDocked: (v: boolean) => void;
  setCommandOpen: (v: boolean) => void;
  logActivity: (text: string) => void;
  setStoragePath: (p: string) => void;
};

const seedToDataset = (s: SeedDataset): Dataset => ({
  ...s,
  pipeline: [],
  redoStack: [],
});

export const useWorkspace = create<Store>()(
  persist(
    (set) => ({
      datasets: seedDatasets.map(seedToDataset),
      activeDatasetId: null,
      aiMessages: [
        {
          id: 'welcome',
          role: 'assistant',
          text: "Hi! I'm your Data Copilot. Ask me to clean, transform, visualize, or explain any part of your dataset.",
          createdAt: new Date().toISOString(),
        },
      ],
      copilotDocked: true,
      copilotOpen: false,
      commandOpen: false,
      activity: [
        { id: 'a1', text: 'Loaded sample dataset: Q4 Sales', at: new Date().toISOString() },
      ],
      storagePath: '~/DataWorkspace',

      setActiveDataset: (id) => set({ activeDatasetId: id }),
      addDataset: (d) =>
        set((s) => ({
          datasets: [d, ...s.datasets],
          activity: [{ id: crypto.randomUUID(), text: `Uploaded ${d.name}`, at: new Date().toISOString() }, ...s.activity].slice(0, 30),
        })),
      removeDataset: (id) => set((s) => ({ datasets: s.datasets.filter((d) => d.id !== id) })),
      addStep: (datasetId, step) =>
        set((s) => ({
          datasets: s.datasets.map((d) =>
            d.id === datasetId
              ? { ...d, pipeline: [...d.pipeline, step], redoStack: [], updatedAt: new Date().toISOString() }
              : d,
          ),
        })),
      removeStep: (datasetId, stepId) =>
        set((s) => ({
          datasets: s.datasets.map((d) =>
            d.id === datasetId ? { ...d, pipeline: d.pipeline.filter((p) => p.id !== stepId) } : d,
          ),
        })),
      undoStep: (datasetId) =>
        set((s) => ({
          datasets: s.datasets.map((d) => {
            if (d.id !== datasetId || d.pipeline.length === 0) return d;
            const last = d.pipeline[d.pipeline.length - 1];
            return { ...d, pipeline: d.pipeline.slice(0, -1), redoStack: [...d.redoStack, last] };
          }),
        })),
      redoStep: (datasetId) =>
        set((s) => ({
          datasets: s.datasets.map((d) => {
            if (d.id !== datasetId || d.redoStack.length === 0) return d;
            const last = d.redoStack[d.redoStack.length - 1];
            return { ...d, pipeline: [...d.pipeline, last], redoStack: d.redoStack.slice(0, -1) };
          }),
        })),
      addAiMessage: (m) => set((s) => ({ aiMessages: [...s.aiMessages, m] })),
      clearAiMessages: () => set({ aiMessages: [] }),
      toggleCopilot: () => set((s) => ({ copilotOpen: !s.copilotOpen })),
      setCopilotDocked: (v) => set({ copilotDocked: v }),
      setCommandOpen: (v) => set({ commandOpen: v }),
      logActivity: (text) =>
        set((s) => ({
          activity: [{ id: crypto.randomUUID(), text, at: new Date().toISOString() }, ...s.activity].slice(0, 30),
        })),
      setStoragePath: (p) => set({ storagePath: p }),
    }),
    {
      name: 'datatidy-workspace',
      partialize: (s) => ({
        datasets: s.datasets,
        activeDatasetId: s.activeDatasetId,
        storagePath: s.storagePath,
        copilotDocked: s.copilotDocked,
      }),
    },
  ),
);
