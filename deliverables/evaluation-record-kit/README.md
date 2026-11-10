# MITRA evaluation record kit

This directory contains the repository-held 30- and 90-case pilot questions and automated score report, along with blank rating/adjudication templates and an unfilled run manifest. The pilot outputs are automated development diagnostics, not independent human evaluation. The runner does not collect human ratings or compute inter-rater agreement; earlier agreement values were simulated and are no longer emitted. No reviewer approvals or completed independent ratings are present.

1. Create a new private run directory, for example backend/evaluation/reports/independent-run-01 (already ignored by Git). Use new independently authored questions; do not reuse the existing pilot questions as held-out cases. Copy only blank templates and the manifest, not the pilot report. Back it up privately; do not rely on Git for private raw records.
2. Read docs/INDEPENDENT_EVALUATION_STRENGTHENING_REVIEW.md and agree the protocol before collecting questions.
3. Fill run-manifest.json. Independent reviewers label the new case file against frozen documentary sources before seeing MITRA answers. Use actual author/reviewer codes; keep personal identity mappings private.
4. Save exact UI responses or API payloads under raw/, one file per case/turn/attempt, and index them in responses.csv. Save hashes, sources and timestamps. Screenshots supplement rather than replace text. A browser run and API run are different capture modes.
5. Give separate copies of ratings-template.csv to reviewer R1 and reviewer R2. They enter their own reviewer IDs and real response/case IDs. The same template rating IDs may be reused only within separate files; use composite reviewer+rating IDs in adjudication.csv. Preserve returned original files.
6. Complete adjudication.csv after both ratings, preserving disagreement and rationale. Summarize only real eligible scored responses with explicit denominators. Exclude blank stubs from all counts.

## Labels

reference_answerability: answerable / ambiguous / unsupported / partially-answerable.
reference_expected_decision and actual_decision: answer / clarify / abstain / refer / technical-error.
correctness: correct / partial / incorrect / not-applicable.
completeness: complete / partial / incomplete / not-applicable.
evidence_support: full / partial / unsupported / contradicted / not-applicable.
decision_appropriate and other Boolean judgments: yes / no / not-applicable; unknown stays blank with rationale.
Language scores: 1 serious meaning/communication problems; 2 substantial problems; 3 understandable with problems; 4 clear with minor problems; 5 clear and appropriate. Score meaning, terminology and fluency separately; do not score an unqualified language review.

CSV files are UTF-8 with a BOM for Excel and Marathi/Hindi support. Use Excel Data > From Text/CSV when necessary; import identifiers, timestamps and raw response text as text. Do not execute spreadsheet formulas from pasted user text. Keep complete raw UTF-8 transcripts outside cells, including long answers. An output ID does not mean that an actual output was collected.

## Integrity and analysis

For a file hash in PowerShell: Get-FileHash -Algorithm SHA256 -LiteralPath <file>. Store the result with the exact file/version. Never rewrite transcripts after hashing. SHA-256 detects changes; it does not prove reviewer independence or truth. Preserve raw scores, adjudication and analysis as different files. No automatic result formulas or fabricated totals are included.

Keep the existing 30/90-case automated pilot report separate from any independent run. Re-running those exposed cases produces a new development diagnostic, not a retrospective original dataset or a new held-out set.
