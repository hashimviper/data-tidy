# Architecture Rules

- Keep data ingestion, transformation, validation, and export-profile checks in reusable client-side TypeScript modules so every cleaning mode shares the same auditable pipeline.