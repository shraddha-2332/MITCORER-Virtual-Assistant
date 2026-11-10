**What this proposes**

The document proposes a design-and-implementation paper about Mitra, an institutional information assistant that combines maintained records, deterministic rendering for selected critical facts, bounded query interpretation, provenance, and optional checked generation. It treats reduced factual errors as a research question, not a demonstrated result: independent questions, labels, and measurements are still needed before making comparative claims. The planned study separates retrieval metrics from end-to-end answer quality and explicitly includes wrong-row cases, multilingual judgments, and operational metrics.

**How the existing system works, per this document**

Mitra serves MITCORER admission and campus information that can depend on programme, academic year, admission route, and applicant attributes. Selected fee, intake, and seat-matrix topics use maintained records and deterministic rendering; other routes may use bounded retrieval and optional evidence-conditioned generation, with selected numeric, promise, and slot checks. Administrators can review staged source changes, while freshness is not universally synchronized. The document reports local regression and diagnostic checks, but says independent answer quality, production deployment, load, recovery, and public conversation session isolation remain unverified.

## Findings

### Unexplained retrieval and generation limits — Major

**Affected scope:** Assessment; Revised abstract foundation; Claims and evidence boundaries

The document uses “bounded retrieval” and “bounded multilingual query interpretation” without explaining their limits or how they operate. It also names “advisory generation routing” and “source provenance” without defining what those mean in this system. The broad architecture is understandable, but a reader cannot tell which queries use retrieval or generation, what bounds apply, or what provenance contains.

### Conversation and scope terms are underspecified — Major

**Affected scope:** Implementation corrections in this increment; Claims and evidence boundaries

“Scope parser,” “profile/topic context,” and “public conversation” are central to the listed fixes and limitations, but the document does not explain what state they represent or how the parser determines scope. The note that continuation relies on a supplied conversation ID identifies a risk, but does not explain the public conversation flow or the consequence of that reliance.

### Planned baseline types are unclear — Nit

**Affected scope:** Planned experiment, step 4

“Conceptual/hybrid retrieval” and “controlled document-generation baseline” are not defined. The plan does not specify what makes these baselines conceptual or controlled, leaving the intended comparisons unclear.

## Reviewer Status

EGM Comprehension completed. The reviewer read the persona and the entire target document only, as required for this stage.
