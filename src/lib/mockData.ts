import type { ColumnSchema, Dataset, QualityIssue } from '@/store/workspace';

export type SeedDataset = Omit<Dataset, 'pipeline' | 'redoStack'>;

const iso = (d: Date) => d.toISOString();

function makeSalesRows(n: number) {
  const regions = ['North', 'South', 'East', 'West'];
  const products = ['Widget', 'Gadget', 'Gizmo', 'Doohickey', 'Thingamajig'];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < n; i++) {
    const price = 20 + Math.round(Math.random() * 480);
    const qty = 1 + Math.floor(Math.random() * 20);
    rows.push({
      order_id: `ORD-${10000 + i}`,
      date: iso(new Date(2024, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28))).slice(0, 10),
      region: regions[i % regions.length],
      product: products[i % products.length],
      quantity: qty,
      unit_price: price,
      revenue: price * qty,
      customer_segment: ['SMB', 'Enterprise', 'Consumer'][i % 3],
    });
  }
  return rows;
}

function makeHrRows(n: number) {
  const depts = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      employee_id: `EMP-${1000 + i}`,
      name: `Employee ${i + 1}`,
      department: depts[i % depts.length],
      age: 22 + Math.floor(Math.random() * 40),
      salary: 40000 + Math.floor(Math.random() * 90000),
      joining_date: iso(new Date(2018 + (i % 6), i % 12, 1 + (i % 27))).slice(0, 10),
      attendance_pct: 70 + Math.round(Math.random() * 30),
    });
  }
  return rows;
}

const salesRows = makeSalesRows(120);
const hrRows = makeHrRows(80);

const salesSchema: ColumnSchema[] = [
  { name: 'order_id', type: 'text', nullPct: 0, unique: salesRows.length, samples: salesRows.slice(0, 3).map((r) => r.order_id) },
  { name: 'date', type: 'date', nullPct: 0, unique: 90, samples: salesRows.slice(0, 3).map((r) => r.date) },
  { name: 'region', type: 'categorical', nullPct: 0, unique: 4, samples: ['North', 'South', 'East'] },
  { name: 'product', type: 'categorical', nullPct: 2, unique: 5, samples: ['Widget', 'Gadget', 'Gizmo'] },
  { name: 'quantity', type: 'numeric', nullPct: 0, unique: 20, samples: [3, 7, 12], min: 1, max: 20, mean: 10.4 },
  { name: 'unit_price', type: 'numeric', nullPct: 0, unique: 90, samples: [49, 129, 299], min: 20, max: 500, mean: 260 },
  { name: 'revenue', type: 'numeric', nullPct: 0, unique: 110, samples: [147, 903, 3588], min: 20, max: 10000, mean: 2704 },
  { name: 'customer_segment', type: 'categorical', nullPct: 3, unique: 3, samples: ['SMB', 'Enterprise', 'Consumer'] },
];

const hrSchema: ColumnSchema[] = [
  { name: 'employee_id', type: 'text', nullPct: 0, unique: hrRows.length, samples: hrRows.slice(0, 3).map((r) => r.employee_id) },
  { name: 'name', type: 'text', nullPct: 5, unique: hrRows.length, samples: ['Employee 1', 'Employee 2'] },
  { name: 'department', type: 'categorical', nullPct: 0, unique: 5, samples: ['Engineering', 'Sales'] },
  { name: 'age', type: 'numeric', nullPct: 2, unique: 40, samples: [28, 35, 44], min: 22, max: 61, mean: 39 },
  { name: 'salary', type: 'numeric', nullPct: 4, unique: 75, samples: [55000, 78000, 120000], min: 40000, max: 129000, mean: 82000 },
  { name: 'joining_date', type: 'date', nullPct: 1, unique: 70, samples: hrRows.slice(0, 3).map((r) => r.joining_date) },
  { name: 'attendance_pct', type: 'numeric', nullPct: 6, unique: 30, samples: [88, 92, 76], min: 70, max: 100, mean: 88 },
];

const salesIssues: QualityIssue[] = [
  { id: 'i1', column: 'product', type: 'missing', severity: 'low', count: 2, message: '2 missing product names' },
  { id: 'i2', column: 'customer_segment', type: 'missing', severity: 'medium', count: 4, message: '4 missing customer segments' },
  { id: 'i3', column: 'revenue', type: 'outlier', severity: 'medium', count: 3, message: '3 revenue outliers detected (>3σ)' },
  { id: 'i4', type: 'duplicate', severity: 'low', count: 1, message: '1 duplicate order_id row' },
];

const hrIssues: QualityIssue[] = [
  { id: 'h1', column: 'salary', type: 'missing', severity: 'high', count: 4, message: 'Salary missing in 4 rows' },
  { id: 'h2', column: 'name', type: 'missing', severity: 'medium', count: 5, message: 'Name missing in 5 rows' },
  { id: 'h3', column: 'age', type: 'outlier', severity: 'low', count: 2, message: '2 age values outside expected range' },
  { id: 'h4', column: 'joining_date', type: 'format', severity: 'medium', count: 3, message: '3 joining dates in inconsistent format' },
];

export const seedDatasets: SeedDataset[] = [
  {
    id: 'ds-sales',
    name: 'Q4 Sales 2024',
    format: 'csv',
    rowCount: salesRows.length,
    colCount: salesSchema.length,
    quality: 87,
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)),
    updatedAt: iso(new Date(Date.now() - 1000 * 60 * 60 * 5)),
    schema: salesSchema,
    rows: salesRows,
    issues: salesIssues,
  },
  {
    id: 'ds-hr',
    name: 'Employee Roster',
    format: 'xlsx',
    rowCount: hrRows.length,
    colCount: hrSchema.length,
    quality: 72,
    createdAt: iso(new Date(Date.now() - 1000 * 60 * 60 * 24 * 10)),
    updatedAt: iso(new Date(Date.now() - 1000 * 60 * 60 * 24)),
    schema: hrSchema,
    rows: hrRows,
    issues: hrIssues,
  },
];
