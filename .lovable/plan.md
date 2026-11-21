# Reliable Local Data Cleaning

## Build
- Strengthen local ingestion for CSV, Excel, and JSON inputs with safer header normalization, placeholder/null recognition, ragged-row diagnostics, and character cleanup.
- Make cleaning transformations conditional and auditable: robust numeric/date/boolean parsing, protected identifiers and sensitive fields, conservative category cleanup, explicit imputation flags, and outlier handling that preserves numeric intent.
- Add post-clean verification and visible quality/audit summaries, plus selectable BI Ready, ML Training Ready, and Data Engineering Ready export profiles with checks rather than unsupported guarantees.
- Add focused tests for concrete parsing, protection, numeric integrity, and export-profile validation rules.

## Technical details
- Keep processing client-side and reuse the existing React/TypeScript cleaning pipeline.
- Treat ambiguous or invalid values as flagged issues; do not silently invent IDs, names, sensitive values, dates, or business-domain corrections.
- Verify with focused unit tests and a real local-cleaning flow in the preview; report any limitations plainly.
