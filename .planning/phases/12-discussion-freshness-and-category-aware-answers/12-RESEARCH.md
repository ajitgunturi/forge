# Phase 12: Discussion Freshness And Category-Aware Answers - Research

**Researched:** 2026-03-03
**Domain:** Forge discussion analyzer freshness detection, fetch orchestration, and category-aware rendering
**Confidence:** HIGH

## User Constraints

### Locked Decisions

- If the user explicitly asks for current/fresh/latest discussion status, or for discussions from a specific date, datetime, or requested time period, the workflow should implicitly do a forced fetch/refresh without requiring a user instruction.
- If the user asks for issues, the analyzer should answer tersely that it handles discussions only and ask whether the user wants discussions for the requested period instead.
- Answers should classify discussions using the GitHub categories available in the fetched dataset and show relevant information under those categories.
- Existing local discussion artifacts remain valid for requests that are clearly about summaries, themes, or gap analysis over already-present local information rather than freshness-sensitive current-status or time-slice requests.

### Claude's Discretion

- How to detect when a time-scoped request is freshness-sensitive enough to force refresh automatically
- Whether freshness detection lives in the analyzer layer, a request parser, or shared discussion filter utilities
- The exact answer shape for category-grouped summaries, counts, and per-discussion details
- Whether classification should rely only on GitHub category names or also include the existing derived `kind` and `status` signals inside each category section
- How much structured metadata to persist in analysis traces so later support debugging can explain why a refresh did or did not happen

### Deferred Ideas

- Full GitHub Issues ingestion or unified issues-plus-discussions analysis
- Background scheduled sync of discussions independent of user requests; current Forge has no periodic sync scheduler today
- Rich time parsing for natural language beyond the date and window formats already supported by Forge
- Cross-assistant policy tuning outside the installed Copilot summonable path

## Current State

The current analyzer only refreshes when the caller sets `refresh` explicitly. In [`src/services/discussions/analyze.ts`](/Users/ajitg/workspace/forge/src/services/discussions/analyze.ts#L23), `runDiscussionAnalyzer()` chooses between `refreshAndPrepareDigest()` and `loadOrPrepareDigest()` based solely on `options.refresh`. Nothing in the analyzer parses the user question first to decide whether the question itself implies freshness.

The existing freshness-related parsing is split and inconsistent:

- [`src/services/discussions/analyze.ts`](/Users/ajitg/workspace/forge/src/services/discussions/analyze.ts#L187) has `deriveCountSummary()` and `extractTemporalFilter()`, but these are render-time helpers used only for count-style answers.
- [`src/services/discussions/filters.ts`](/Users/ajitg/workspace/forge/src/services/discussions/filters.ts#L15) normalizes explicit CLI filters like `--when`, `--after`, and `--before`, but it does not parse freeform question text.
- [`src/services/discussions/run.ts`](/Users/ajitg/workspace/forge/src/services/discussions/run.ts#L19) persists the fetch filters into the `DiscussionRun`, so the data needed to explain what was fetched already exists.

Issue redirection exists, but the answer is too long for the new requirement. [`assertDiscussionScopedQuestion()` in `analyze.ts`](/Users/ajitg/workspace/forge/src/services/discussions/analyze.ts#L150) throws `DiscussionsOnlyAnalyzerError` with a multi-paragraph correction block and sample prompts. The phase wants a terse redirect instead.

Category information already survives the pipeline, but rendering does not use it as the primary grouping:

- Raw fetched records store the GitHub category object in [`DiscussionRecord` in `src/contracts/discussions.ts`](/Users/ajitg/workspace/forge/src/contracts/discussions.ts#L19).
- Prepared records flatten that to `record.category` in [`buildPreparedRecord()` in `src/services/discussions/prepare.ts`](/Users/ajitg/workspace/forge/src/services/discussions/prepare.ts#L114).
- Rendering currently shows one mixed table plus a flat detail list in [`renderAnswer()`](/Users/ajitg/workspace/forge/src/services/discussions/analyze.ts#L42). The “Category” column is actually populated with `record.kind`, not the real GitHub category, which is a direct seam this phase needs to fix.

Derived insights already exist and should be preserved rather than replaced:

- `kind` is derived in [`classifyDiscussionKind()`](/Users/ajitg/workspace/forge/src/services/discussions/prepare.ts#L135).
- `status` is derived in [`classifyDiscussionStatus()`](/Users/ajitg/workspace/forge/src/services/discussions/prepare.ts#L146).
- Digest totals currently summarize by derived `kinds` and `statuses`, not by GitHub category, in [`buildPreparedDiscussionDigest()`](/Users/ajitg/workspace/forge/src/services/discussions/prepare.ts#L61).

Trace persistence exists but does not explain freshness decisions. [`persistAnalysisTrace()`](/Users/ajitg/workspace/forge/src/services/discussions/analyze.ts#L279) stores the digest, question, and answer, but not whether the analyzer used cache, refreshed implicitly, or why that decision was made.

## Recommended Architecture

Create a small request-analysis layer ahead of fetch/digest/render. The planner should treat this as the main design move for the phase.

### 1. Add a question intent model

Introduce a new helper, likely under `src/services/discussions/request-intent.ts`, that converts the user question plus explicit CLI options into a normalized analyzer intent. It should produce a structure like:

```ts
type DiscussionAnalyzerIntent = {
  scope: 'discussions' | 'issues';
  refreshMode: 'required' | 'not-required';
  refreshReason:
    | 'explicit-cli-refresh'
    | 'time-scoped-question'
    | 'no-local-artifacts'
    | 'cached-local-question';
  parsedFilters: {
    when?: 'today' | 'yesterday' | 'last-week';
    after?: string;
    before?: string;
    category?: string;
    temporalField?: 'createdAt' | 'updatedAt';
  };
  answerShape: {
    wantsCounts: boolean;
    wantsPatterns: boolean;
    wantsEffectiveness: boolean;
  };
};
```

This keeps parsing decisions out of the renderer and gives one place to decide refresh, issue redirection, and answer style.

### 2. Use question-derived filters to drive implicit refresh

`runDiscussionAnalyzer()` should change from “refresh if caller passed a boolean” to “resolve intent, then refresh if intent requires it.” The order should be:

1. Parse intent from question and explicit CLI flags.
2. Fail fast on issue-only requests with a short redirect.
3. If explicit CLI refresh is set, refresh.
4. Else if the question is freshness-sensitive, refresh.
5. Else load cached digest or prepare from latest run.
6. Render using the same intent object.

This architecture satisfies the requirement without needing the user to say “force sync,” and it preserves local-only behavior for safe cached questions.

### 3. Make freshness detection explicit and bounded

Planning should explicitly avoid vague “seems recent” heuristics. Use deterministic triggers:

- Currentness phrases: `current status`, `latest status`, `latest`, `current`, `fresh`, `up to date` when paired with discussion status/state wording
- Relative windows: `today`, `yesterday`, `last week`
- Explicit date bounds: `since YYYY-MM-DD`, `after YYYY-MM-DD`, `before YYYY-MM-DD`
- Ranges: `between YYYY-MM-DD and YYYY-MM-DD`
- Explicit timestamps / datetimes when `Date.parse()` succeeds and the phrase clearly scopes discussions by time
- Scoped verbs and nouns near a temporal phrase: `from`, `created`, `updated`, `opened`, `during`, `between`

If one of these appears in the question text in a way that clearly asks for currentness or a bounded time slice, mark the request as freshness-sensitive and refresh automatically.

This logic belongs near question parsing, not in `filters.ts` alone. `filters.ts` should still own canonical normalization once a parser extracts `when/after/before/category`. The parser should not duplicate date-boundary normalization rules.

### 4. Distinguish cached/local-only questions from freshness-sensitive questions

Use this decision rule:

- Safe cached/local-only questions: questions about summaries, trends, themes, unresolved items, categories, statuses, counts, or gap analysis with no explicit time phrase and no wording that asks for current/latest status.
- Freshness-sensitive questions: questions that ask for current/fresh/latest status, or any question with explicit date/time scope, even if it could technically be answered from stale local artifacts.

Concrete examples:

- Cached/local-only: “What unresolved discussions do we have?”, “Summarize the Ideas category”, “What patterns are visible in support discussions?”
- Cached/local-only: “Give me a summary of discussions since Jan 1 from local data”, “Identify the main gaps across support discussions”
- Freshness-sensitive: “What is the current status of customer support discussions?”, “What discussions were created today?”, “Count discussions since 2026-01-01”, “Show Q&A discussions from last week”, “What was updated between 2026-02-01 and 2026-02-15?”

Do not make freshness depend on whether cached data happens to overlap the requested window. The locked decision is user-intent-based: explicit currentness or explicit time scoping means refresh; generic summaries and gap analysis do not.

### 5. Group rendering by real GitHub category, preserve derived insights inside each group

Rendering should pivot from a flat mixed table to category-first sections. The right shape is:

1. Header metadata
2. Optional global count summary
3. Category summary table
4. Repeated sections per actual GitHub category
5. Optional cross-category pattern/effectiveness sections

Each category section should include:

- Category name as the section header, sourced from `record.category`
- Count of matching discussions in that category
- Status breakdown within that category
- Kind breakdown within that category
- The matching discussions in that category, with per-record title, status, derived kind, issue, resolution, and action items

This preserves the current `kind` and `status` work as secondary analysis, while making GitHub category the primary navigation structure.

Do not replace category with derived kind in headers or tables. The current bug where “Category” displays `record.kind` should be removed as part of the renderer rewrite.

### 6. Persist freshness decisions in analysis traces

Extend `DiscussionAnalysisTrace` with a small execution metadata block:

```ts
decision: {
  refreshUsed: boolean;
  refreshReason: string;
  parsedFilters: {
    when?: string;
    after?: string;
    before?: string;
    category?: string;
  };
  source: 'explicit-refresh' | 'implicit-refresh' | 'cached-digest';
}
```

This is enough for support debugging without over-designing trace storage.

### 7. Keep CLI compatibility, but make explicit refresh optional

The CLI flags in [`src/program.ts`](/Users/ajitg/workspace/forge/src/program.ts#L41) should remain for manual control and testing. The behavior change should be:

- `--force-refresh` still forces a fetch.
- `--refresh-analysis` still forces digest rebuild from existing raw fetch data.
- No refresh flag required when the question itself is time-scoped.

That means planner scope should include service behavior changes first, and only small CLI wording updates if needed.

## Plan-Shaping Constraints

The main constraint is separation of concerns. Right now `analyze.ts` is doing orchestration, issue correction, temporal parsing, relevance scoring, rendering, and trace persistence. Planning should not add more phase logic to that file without extracting helpers first, or Phase 12 will deepen the existing coupling.

The fetch layer orders discussions by `UPDATED_AT` and filters windows by `updatedAt` in [`fetch.ts`](/Users/ajitg/workspace/forge/src/services/discussions/fetch.ts#L84). Meanwhile count rendering can switch between `createdAt` and `updatedAt` depending on the question. Planning must resolve whether an implicit refresh for “created since date” should still use the existing fetch windowing, or whether the initial fetch window is only a recency narrowing step and final record matching handles `createdAt`. The simplest plan is to keep fetch filtering on `updatedAt` for now, accept that it limits API volume, and let answer-time matching decide `createdAt` vs `updatedAt`. If that feels semantically wrong, the plan should explicitly call it out and add verification for it.

The current `PreparedDiscussionRecord` stores only the category name, not slug or category ID. That is enough for grouped rendering, but if the planner wants stable sort/group behavior or richer debugging, it may need to preserve category slug in prepared records too. This is optional, not mandatory, but planning should decide deliberately.

The parser should stay within the phase boundary. The context explicitly defers rich natural-language time parsing, so planning should target the formats already implied by current Forge behavior plus the user examples: `today`, `yesterday`, `last week`, `since`, `after`, `before`, and simple date/date-time ranges.

The terse issue redirect is a product requirement, but it should remain helpful. The message should be one or two lines, preserve the requested time period if one was parsed, and avoid the current multi-example block.

## Testing Strategy

Unit coverage today exercises filter normalization, fetch paging, digest prep, basic analyzer rendering, count summaries on cached data, and the long-form issue redirect in [`tests/unit/services/discussions.test.ts`](/Users/ajitg/workspace/forge/tests/unit/services/discussions.test.ts#L1). It does not cover the core behavior this phase adds.

The plan should add unit tests for these scenarios:

- Question intent parsing:
  - Detect `today`, `yesterday`, `last week`
  - Detect `since`, `after`, `before`
  - Detect `between ... and ...`
  - Ignore non-temporal phrases that contain similar words
  - Carry parsed category names from natural language if that parsing is added in-scope
- Refresh decisioning:
  - Time-scoped question triggers implicit refresh even when `refresh` is false
  - Non-time-scoped question uses cached digest
  - Explicit `--force-refresh` still wins
  - Missing local artifacts still produce a refresh path only when enough fetch inputs exist, otherwise the existing artifact error remains clear
- Issue redirection:
  - “issues” request throws the shorter redirect
  - Redirect preserves the requested period in the suggested replacement when possible
- Rendering:
  - Output groups records by actual GitHub category
  - Category summary uses real category labels, not `kind`
  - Derived `kind` and `status` remain visible inside category sections
  - Count summaries still work when category grouping is enabled
  - Pattern/effectiveness sections still work after the renderer changes
- Trace persistence:
  - Latest analysis trace records `refreshUsed`, `refreshReason`, and parsed filters

The plan should also add at least one smoke or end-to-end style test modeled on the user feedback:

1. Seed stale local artifacts.
2. Ask a dated question such as “count discussions created since 2026-01-01”.
3. Verify Forge refreshes instead of answering from stale digest only.
4. Verify the answer groups by GitHub category and includes the correct count basis.

If a full CLI/network smoke is too expensive, a service-level integration test with mocked `runDiscussionFetch()` is still necessary. The key verification is decision flow, not GitHub connectivity.

## Risks and Pitfalls

- Parser duplication risk: if time parsing remains partly in `analyze.ts` and partly in `filters.ts`, behavior will drift again. Planning should unify extraction and normalization paths.
- Ambiguous semantics risk: “created since date” and “updated since date” are not the same. The plan must define which field is used for refresh narrowing versus final answer matching.
- Over-refresh risk: naive keyword detection could refresh on generic phrases like “recent patterns” or “current themes” even though the locked requirement only guarantees explicit current-status asks and explicit date/time scope. Prefer explicit bounded triggers tied to status/currentness wording.
- Under-refresh risk: if the parser only supports CLI-style words and misses `from January 1 2026` or `between 2026-01-01 and 2026-01-31`, the user will hit the same stale-answer problem again.
- Renderer regression risk: changing to category-first output can easily break pattern/effectiveness summaries or count answers unless those sections are deliberately preserved.
- Category sparsity risk: some repositories may have empty categories in the fetched slice. Rendering should group only categories present in matching records, not every repository category ever defined.
- Trace bloat risk: storing full digests already makes traces heavy. Planning should add compact decision metadata, not duplicate more full payloads.

## Open Questions

- Should the parser support natural-language month names immediately, such as “from January 1 2026,” or should Phase 12 restrict itself to ISO dates plus existing relative windows? The phase context mentions that example, so planning should decide whether to support it now or narrow it explicitly.
- Should category filtering from freeform questions be implemented in this phase, or should Phase 12 only improve grouping after records are selected? The examples mention “in Q&A after 2026-02-15,” which suggests parser support may be valuable.
- When the analyzer implicitly refreshes, should it default to the existing `DEFAULT_ANALYZER_REFRESH_LIMIT` of 1000, or should the limit derive from question type or prior cached run metadata?
- Should `PreparedDiscussionDigest.totals` add per-category counts to simplify rendering, or should grouping be computed on demand in the renderer?
- Should the short issue redirect be purely corrective text, or should it also offer a concrete rewritten prompt using any parsed date window?

## Plan Recommendation

Plan this phase as three implementation slices plus verification.

First, extract request parsing and freshness decisioning into a dedicated helper that returns normalized filters, issue scope, and refresh intent. Make `runDiscussionAnalyzer()` consume that helper so implicit refresh is driven by user question semantics rather than a manual boolean, and so generic summary/gap-analysis requests can stay on cached local artifacts.

Second, refactor answer rendering into a category-first renderer that groups by actual GitHub category and treats derived `kind` and `status` as intra-category insights. Fix the current mislabeled “Category” column as part of this step, and keep count/pattern/effectiveness sections working on top of the new grouping.

Third, extend analysis traces with refresh-decision metadata and tighten the issue redirect message to the required terse form. Finish with unit tests for parser and decision logic, plus one feedback-style integration test that proves a dated request refreshes automatically instead of relying on stale local artifacts.
