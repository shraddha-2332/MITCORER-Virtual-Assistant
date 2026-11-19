# Factual and language review

**AI review completed:** see [the AI findings and corrections](AI_REVIEW.md) and [per-case AI annotations](ai-review.json). These are separate from the blank human ratings below. The reviewed packet preserves the pre-fix outputs.

This packet screens the 150 outputs from the successful post-D11 diagnostic. It does not certify independent accuracy. Open [review-sheets.md](review-sheets.md) to read each question, answer and cited passage; enter structured ratings in [review-packet.json](review-packet.json). All human ratings start blank. [screening-summary.json](screening-summary.json) contains reproducible counts. Regenerate only before review begins with `node scripts/prepare-answer-review.mjs`; regeneration replaces the packet and sheets.

## Screening findings

- 54 answers cite at least one record without a source URL: obtain the underlying approved document, including page/date and authority.
- 121 answers cite evidence whose verification status is not `verified`: check its institutional validity and academic-year scope. Missing metadata does not prove an error.
- 28 answers explicitly request Marathi or Hindi: competent-speaker review is required.
- 12 outputs explicitly report partial or fallback localization: prioritize admissions, documents, scholarship and contact guidance.
- No cited passage hash mismatch was found. Matching a hash proves passage integrity, not claim truth.

These groups overlap. Review all answers, including abstentions; unflagged cases have not been approved.

## Limited official-web spot check

On 18 November 2026 the browsing tool returned content for the [2026-27 admissions landing page](https://www.mitcorer.edu.in/Admissions-Open-2026-27.html). Its body lists the institutional name, DTE code 06901, programmes and contact number +91 84599 67882. This is limited corroboration, not verification of all 150 answers. The returned page was labelled as crawled four months earlier, so it is not proof of a fresh live institutional record. It does not establish the detailed category-specific fee schedule used by the application.

The page mixes a 2026-27 admissions heading with a highest-package claim explicitly dated 2023 and broader aggregate placement claims. Preserve each claim's date; do not relabel it as a current-year outcome. Animated counters appearing as zero are not reliable totals. No institutional records were edited based on these observations.

The scholarship and contact routes attempted during this check were inaccessible through the browsing tool. That is a tool retrieval failure, not proof that either page is down. Their content remains unverified by this check.

## Completing review

A domain reviewer should attach authoritative documents and adjudicate fees, eligibility, intake, cutoff scope and uncertainty. Marathi/Hindi speakers should separately rate meaning, conditions, numbers and labels, fluency and terminology. Record anonymous reviewer codes, competence, date and any development involvement. Do not fill ratings using automated pass results.

For an independent benchmark, authors who did not tune MITRA must supply fresh questions before seeing model answers. Freeze those questions and their source-based expected decisions before showing authors or reviewers MITRA's answers. The 150 exposed scenarios remain development data even if humans later review them.

No outreach, paid model judging, production changes or deployment was performed.
