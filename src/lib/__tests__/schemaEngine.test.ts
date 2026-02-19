import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  stringSimilarity,
  validateSchema,
  autoTransform,
  inferSchemaFromData,
  transformData,
  TargetSchema,
} from '@/lib/schemaEngine';

describe('Levenshtein Distance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('calculates correct distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('Cust_ID', 'customer_id')).toBeGreaterThan(0);
  });
});

describe('String Similarity', () => {
  it('returns 100 for identical normalized strings', () => {
    expect(stringSimilarity('customer_id', 'Customer_ID')).toBe(100);
  });

  it('gives high score for close variations', () => {
    const score = stringSimilarity('Cust_ID', 'customer_id');
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it('gives low score for unrelated strings', () => {
    const score = stringSimilarity('email', 'revenue');
    expect(score).toBeLessThan(50);
  });
});

describe('Schema Validation', () => {
  const targetSchema: TargetSchema = {
    columns: [
      { name: 'customer_id', type: 'number', required: true },
      { name: 'full_name', type: 'string', required: true, aliases: ['name', 'customer_name'] },
      { name: 'email', type: 'string' },
      { name: 'order_date', type: 'date' },
      { name: 'total_amount', type: 'number' },
    ],
  };

  it('matches exact column names (case-insensitive)', () => {
    const result = validateSchema(['Customer_ID', 'Email', 'Total_Amount'], targetSchema);
    const exactMatches = result.mappings.filter(m => m.status === 'exact');
    expect(exactMatches.length).toBeGreaterThanOrEqual(2);
  });

  it('fuzzy matches Cust_ID to customer_id', () => {
    const result = validateSchema(['Cust_ID', 'Name', 'email_addr', 'OrderDate', 'Amount'], targetSchema);
    const custMapping = result.mappings.find(m => m.sourceColumn === 'Cust_ID');
    expect(custMapping?.suggestedTarget).toBe('customer_id');
    expect(custMapping?.confidence).toBeGreaterThanOrEqual(50);
  });

  it('resolves aliases', () => {
    const result = validateSchema(['customer_name'], targetSchema);
    const nameMapping = result.mappings.find(m => m.sourceColumn === 'customer_name');
    expect(nameMapping?.suggestedTarget).toBe('full_name');
    expect(nameMapping?.status).toBe('exact'); // alias = exact
  });

  it('marks unmatched columns', () => {
    const result = validateSchema(['xyz_unknown_col'], targetSchema);
    expect(result.unmappedSource.length).toBe(1);
  });

  it('reports missing required target columns', () => {
    const result = validateSchema(['email'], targetSchema);
    expect(result.unmappedTarget).toContain('customer_id');
    expect(result.unmappedTarget).toContain('full_name');
  });
});

describe('Type Enforcement', () => {
  it('moves rows with bad dates to error log', () => {
    const schema: TargetSchema = {
      columns: [
        { name: 'id', type: 'number' },
        { name: 'date', type: 'date' },
      ],
    };

    const data = [
      { id: '1', date: '2024-01-15' },
      { id: '2', date: 'not-a-date' },
      { id: '3', date: '03/15/2024' },
    ];

    const result = transformData(data, schema, { id: 'id', date: 'date' });
    expect(result.data.length).toBe(2);
    expect(result.errorRows.length).toBe(1);
    expect(result.qualitySummary.rowsFailed).toBe(1);
  });

  it('casts numbers correctly', () => {
    const schema: TargetSchema = {
      columns: [{ name: 'amount', type: 'number' }],
    };

    const data = [
      { amount: '1,234.56' },
      { amount: 'abc' },
    ];

    const result = transformData(data, schema, { amount: 'amount' });
    expect(result.data.length).toBe(1);
    expect(result.data[0].amount).toBe(1234.56);
    expect(result.errorRows.length).toBe(1);
  });
});

describe('Idempotency', () => {
  it('skips duplicate rows on re-processing', () => {
    const schema: TargetSchema = {
      columns: [
        { name: 'id', type: 'number' },
        { name: 'name', type: 'string' },
      ],
    };

    const data = [
      { id: '1', name: 'Alice' },
      { id: '1', name: 'Alice' }, // exact duplicate
      { id: '2', name: 'Bob' },
    ];

    const result = transformData(data, schema, { id: 'id', name: 'name' });
    expect(result.data.length).toBe(2);
    expect(result.qualitySummary.duplicatesSkipped).toBe(1);
  });
});

describe('Auto Transform (full pipeline)', () => {
  it('infers schema and produces quality summary', () => {
    const data = [
      { Cust_ID: '101', Name: 'Alice', Purchase_Date: '2024-01-15', Amount: '99.99' },
      { Cust_ID: '102', Name: 'Bob', Purchase_Date: '2024-02-20', Amount: '149.50' },
      { Cust_ID: '103', Name: 'Charlie', Purchase_Date: 'invalid', Amount: 'abc' },
    ];

    const { validationResult, transformationResult } = autoTransform(data);

    expect(validationResult).toBeDefined();
    expect(validationResult.overallConfidence).toBe(100); // auto-inferred = perfect match
    expect(transformationResult).not.toBeNull();
    expect(transformationResult!.qualitySummary.rowsProcessed).toBe(3);
    expect(transformationResult!.qualitySummary.mappingConfidenceScore).toBe(100);
  });
});
