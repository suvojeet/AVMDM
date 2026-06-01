# Averio MDM — Matching Engine & AI Capability

> **Audience:** Product managers, solution architects, enterprise buyers, and engineers
> who need a comprehensive understanding of how Averio MDM identifies duplicate party
> records — with a detailed focus on the AI enhancement layer built on Azure OpenAI GPT-4.
>
> **Last updated:** 2026-05-31 (added Auto-Training Pipeline, Configurable ML/AI Training Mode)
> **See also:** [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) (algorithm depth),
> [BUSINESS_GUIDE.md](BUSINESS_GUIDE.md) (non-technical overview)

---

## Table of Contents

1. [Why AI in Entity Matching?](#1-why-ai-in-entity-matching)
2. [The Three-Stage Matching Pipeline](#2-the-three-stage-matching-pipeline)
3. [Stage 1 — Deterministic Matching](#3-stage-1--deterministic-matching)
4. [Stage 2 — Probabilistic Matching (Fellegi-Sunter)](#4-stage-2--probabilistic-matching-fellegi-sunter)
5. [Stage 3 — AI Enhancement (GPT-4)](#5-stage-3--ai-enhancement-gpt-4)
6. [The Blended Score Formula](#6-the-blended-score-formula)
7. [What AI Catches That Statistics Miss](#7-what-ai-catches-that-statistics-miss)
8. [Decision Thresholds and Actions](#8-decision-thresholds-and-actions)
9. [Blocking — How Scale is Managed](#9-blocking--how-scale-is-managed)
10. [Self-Learning: The EM Algorithm](#10-self-learning-the-em-algorithm)
11. [Steward Feedback Loop](#11-steward-feedback-loop)
12. [Auto-Training Pipeline](#12-auto-training-pipeline)
13. [Configurable Training Mode: ML vs AI](#13-configurable-training-mode-ml-vs-ai)
14. [Training API Reference](#14-training-api-reference)
15. [Configuration Reference](#15-configuration-reference)
16. [Enabling Azure OpenAI](#16-enabling-azure-openai)
17. [Tuning the AI Layer](#17-tuning-the-ai-layer)

---

## 1. Why AI in Entity Matching?

Statistical models like Fellegi-Sunter are extremely effective when attribute patterns are
regular. They struggle with a class of scenarios that are common in enterprise data:

| Challenge | Example | Why statistics alone fail |
|-----------|---------|--------------------------|
| Cultural name conventions | "Wei Zhang" (CRM) vs "Zhang Wei" (ERP) | Token order varies by cultural norm; stats treat as different names |
| Transliteration variants | "Müller" vs "Mueller" vs "Muller" | Phonetic codes diverge; JW similarity is low despite same person |
| Abbreviation ambiguity | "Int'l Business Machines" vs "IBM" | Token-set fails when one record uses abbreviation, other uses full form |
| Contextual cross-field inference | Tax ID matches but name is very different | May be legitimate (name change) or an error — AI can reason about it |
| Legal name vs trading name | "JP Morgan Chase & Co." vs "JPMorgan" | Prefix-strip doesn't help; need semantic understanding |
| Missing field asymmetry | Record A has DOB, Record B does not | Score is depressed; AI can use remaining context to compensate |

The AI Enhancement layer does not replace the statistical model. It is invoked only for
**borderline cases** — the "grey zone" where statistics are uncertain — and its output
is blended with the statistical score rather than overriding it. This gives the system
the best of both: the speed and auditability of Fellegi-Sunter, and the linguistic
reasoning of a large language model.

---

## 2. The Three-Stage Matching Pipeline

Every incoming party record goes through up to three stages before a decision is made.
Early stages short-circuit the pipeline — a deterministic hit never reaches AI.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  INCOMING PARTY RECORD                                                   │
│  (from any source system: CRM, ERP, Billing, Partner feed …)            │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                           ┌─────────▼──────────┐
                           │  BLOCKING           │  Reduces O(N²) → O(k)
                           │  BlockingKeyService │  k ≈ 10–100 candidates
                           └─────────┬──────────┘
                                     │ candidate pool
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  FOR EACH CANDIDATE                   │
                  │                                       │
                  │  ┌──────────────────────────────┐    │
                  │  │  STAGE 1: DETERMINISTIC       │    │
                  │  │  DeterministicMatcher         │    │
                  │  │  Exact match on: SSN, TaxID,  │    │
                  │  │  EIN, DUNS, LEI, Passport,    │    │
                  │  │  NationalId, SourceSystemId   │    │
                  │  └─────────────┬────────────────┘    │
                  │                │ if hit → score=1.0   │
                  │                │ else continue        │
                  │                ▼                      │
                  │  ┌──────────────────────────────┐    │
                  │  │  STAGE 2: PROBABILISTIC       │    │
                  │  │  ProbabilisticMatcher         │    │
                  │  │  Fellegi-Sunter log-likelihood │    │
                  │  │  26+ attribute vectors        │    │
                  │  │  EM-learned m/u parameters    │    │
                  │  └─────────────┬────────────────┘    │
                  │                │ probabilistic score  │
                  │                │ if score ∈ (0.50,    │
                  │                │   0.90) → continue   │
                  │                │ else → use as final  │
                  │                ▼                      │
                  │  ┌──────────────────────────────┐    │
                  │  │  STAGE 3: AI ENHANCEMENT     │◄── only when:        │
                  │  │  AIEnhancedMatcher (GPT-4)   │    (1) score in grey zone │
                  │  │  Azure OpenAI, temp=0.1      │    (2) rule.useAIEnhancement=true │
                  │  │  Final = 0.6×FS + 0.4×AI    │    (3) Azure OpenAI configured │
                  │  └─────────────┬────────────────┘    │
                  └────────────────┼─────────────────────┘
                                   │ final score per candidate
                                   ▼
                  ┌──────────────────────────────────────┐
                  │  DECISION ENGINE                      │
                  │  score ≥ 0.95  →  AUTO_LINK          │
                  │  score ≥ 0.75  →  SEND_TO_STEWARD    │
                  │  score  < 0.75  →  CREATE_NEW         │
                  └──────────────────────────────────────┘
```

---

## 3. Stage 1 — Deterministic Matching

The `DeterministicMatcher` is the fastest stage and always runs first. It performs
**normalised exact matching** (case-insensitive, whitespace-collapsed) on a fixed
set of high-cardinality identifiers.

### Identifiers checked

| Identifier | Notes |
|------------|-------|
| SSN | Social Security Number — US individuals |
| Tax ID / EIN | Federal Employer Identification Number — organisations |
| DUNS | D-U-N-S Number — 9-digit Dun & Bradstreet identifier |
| LEI | Legal Entity Identifier — 20-char ISO 17442 code |
| Passport | International travel document number |
| National ID | Government-issued national identity number |
| Source System ID | Same record in two different source system snapshots |

**Any single match returns score = 1.0 and action AUTO_LINK.** The pipeline
short-circuits immediately — probabilistic and AI stages are not reached.

### Why this matters

A tax ID match is logically certain. Running the GPT-4 API on a pair that already shares
a unique tax ID would waste latency and cost with no possible accuracy improvement.
The deterministic gate eliminates that waste.

---

## 4. Stage 2 — Probabilistic Matching (Fellegi-Sunter)

The `ProbabilisticMatcher` implements the **Fellegi-Sunter log-likelihood model** —
the same statistical foundation used by the US Census Bureau, the UK ONS (Splink),
and dedupe.io.

### How it works

For each attribute `k` available in both records:

```
agreement score  aₖ ∈ [0.0, 1.0]   (from SimilarityFunctions)
m-probability    mₖ                  (P that attribute agrees | true match)
u-probability    uₖ                  (P that attribute agrees | random non-match)

attribute weight  wₖ = aₖ × ln(mₖ / uₖ)  +  (1 − aₖ) × ln((1−mₖ) / (1−uₖ))

raw score         = Σ wₖ  over all available attributes
final score       = (raw − min_possible) / (max_possible − min_possible)  ∈ [0, 1]
```

### Attributes scored (26+)

**Individual attributes:**

| Attribute | Method | Notes |
|-----------|--------|-------|
| First name | Jaro-Winkler (JW) | Best for short strings |
| First name phonetic | Double Metaphone | "Smith" ↔ "Smyth" |
| First name nickname | NicknameService | "Bob" ↔ "Robert" (0.90 similarity) |
| Last name | Jaro-Winkler | |
| Last name phonetic | Double Metaphone | |
| Full name (token sort) | Token Sort Ratio | Word-order invariant |
| Full name (token set) | Token Set Ratio | Abbreviation-tolerant |
| Full name (bigram) | Bigram Jaccard | Insertion/typo robust |
| Date of birth (exact) | Exact match | |
| Date of birth (partial) | Year-only + transposition | Day/month swap detection |
| SSN | Exact digits | |
| Email (exact) | Normalised exact | |
| Email domain | Domain equality | |
| Phone (exact) | Last 10 digits | |
| Phone (last 7) | Last 7 digits | Country/area code variant |
| Postal code | String similarity | |
| City | Composite similarity | |
| National ID | Exact | |

**Organisation-specific attributes:**

| Attribute | Method | Notes |
|-----------|--------|-------|
| Org name (token sort) | Token Sort Ratio | After suffix stripping |
| Org name (token set) | Token Set Ratio | "IBM Corp" ↔ "IBM" |
| Org name (bigram) | Bigram Jaccard | |
| Org name (Monge-Elkan) | Symmetric ME | Multi-token alignment |
| Org name (TF-IDF) | Cosine similarity | Long names |
| Tax ID | Exact | Near-deterministic |
| DUNS | Exact | |
| LEI | Exact | |

The m/u probabilities are initially set from domain priors and continuously updated
by the EM algorithm (see Section 10).

---

## 5. Stage 3 — AI Enhancement (GPT-4)

### When AI is activated

The AI stage is activated for a candidate pair only when **all three** conditions hold:

| Condition | Check | Default |
|-----------|-------|---------|
| Score is in the borderline zone | `0.50 < probabilisticScore < 0.90` | Always |
| Matching rule opts in | `rule.useAIEnhancement == true` | Per-rule setting |
| Azure OpenAI is configured | `OpenAIClient` bean is present | Requires configuration |

Scores ≤ 0.50 are too low — AI is unlikely to rescue a very weak match and the cost
is not justified. Scores ≥ 0.90 are already high-confidence — AI cannot meaningfully
improve them and could only introduce noise.

### Azure OpenAI integration

The `AIEnhancedMatcher` uses the **Azure OpenAI SDK** (`com.azure.ai.openai`).
The component is declared `@ConditionalOnBean(OpenAIClient.class)` — if Azure OpenAI
is not configured, the bean is never instantiated and the AI stage is transparently
skipped for all records.

```
Azure OpenAI deployment:  gpt-4   (configurable via averio.ai.deployment-name)
Temperature:              0.1     (minimal randomness — deterministic responses)
Max tokens:               200     (sufficient for score + brief explanation)
```

Low temperature is intentional: entity resolution is a factual determination, not a
creative task. We want the model to produce the same answer for the same input pair
every time.

### The prompt

For each borderline candidate pair, the engine builds the following prompt:

```
You are an expert in entity resolution for Master Data Management.
Determine if the following two party records represent the same real-world entity.

Record A:
- Name: {firstName} {lastName}
- Organization: {organizationName}
- DOB: {dateOfBirth}
- Tax ID: {taxId}
- Source: {sourceSystem}

Record B:
- Name: {firstName} {lastName}
- Organization: {organizationName}
- DOB: {dateOfBirth}
- Tax ID: {taxId}
- Source: {sourceSystem}

Respond with ONLY: SCORE:<0.00-1.00>|REASON:<brief explanation>
Example: SCORE:0.92|REASON:Same person, name variation and same DOB
```

**Design decisions in the prompt:**

- **Role specification** ("expert in entity resolution") — grounds the model in the
  domain, reducing generic or ambiguous responses
- **Structured field display** — identical layout for both records enables direct
  comparison without prose paraphrasing
- **Constrained output format** — `SCORE:x.xx|REASON:...` is machine-parseable;
  free-form prose would require NLP to extract a score
- **Temperature 0.1** — combined with the structured prompt, this produces
  highly consistent, low-variance responses

### Response parsing

The engine parses the response with tolerance for model deviations:

```java
// Extract score
int scoreIdx = response.indexOf("SCORE:");
String scoreStr = response.substring(scoreIdx + 6, pipeIdx);
double score = Math.min(1.0, Math.max(0.0, Double.parseDouble(scoreStr.trim())));

// Extract explanation
int reasonIdx = response.indexOf("REASON:");
String explanation = response.substring(reasonIdx + 7).trim();
```

If the model response is malformed, null, or throws any exception, the parser
returns a **neutral score of 0.5** — preserving the probabilistic score's dominant
influence in the blend formula (0.6 × FS + 0.4 × 0.5 = 0.6 × FS + 0.2).

### Fallback behaviour

```
Azure OpenAI unavailable  →  AIEnhancedMatcher bean not created  →  stage silently skipped
                              probabilistic score used as-is

API call throws exception  →  log.warn (never log.error — doesn't break the match)
                               aiScore = 0.5 (neutral)
                               blend: finalScore = probabilisticScore × 0.6 + 0.5 × 0.4

Response unparseable       →  same as exception path
```

The AI stage is designed to be **zero-failure**. A GPT-4 outage or timeout never
prevents a match decision from being returned. At worst, borderline cases fall back
to the probabilistic score alone.

---

## 6. The Blended Score Formula

When AI enhancement runs, the final candidate score is:

```
finalScore = probabilisticScore × 0.6  +  aiScore × 0.4
```

### Rationale for the 60/40 split

| Weight | Reason |
|--------|--------|
| 60% probabilistic | The Fellegi-Sunter score is derived from statistical evidence across 26+ attributes. It is the primary, fully explainable signal. |
| 40% AI | GPT-4 provides linguistic reasoning as a secondary signal. We deliberately keep it minority so the statistical model remains dominant and auditable. |

### Score trajectory examples

| Probabilistic | AI | Blended | Interpretation |
|---------------|-----|---------|----------------|
| 0.82 | 0.95 | 0.87 | AI boosts a likely-match into high confidence |
| 0.82 | 0.30 | 0.61 | AI flags a probable error — score pulled down into CREATE_NEW |
| 0.60 | 0.85 | 0.70 | AI partially recovers a weak statistical match |
| 0.55 | 0.50 | 0.53 | Neutral AI — score unchanged, stays in borderline |
| 0.72 | 0.92 | 0.80 | Borderline pushed into SEND_TO_STEWARD zone |

### The method tag

Every `MatchCandidate` carries a `method` field:

| Value | Meaning |
|-------|---------|
| `DETERMINISTIC` | Exact identifier match — score = 1.0 |
| `PROBABILISTIC` | Fellegi-Sunter only — AI not triggered or not configured |
| `AI_ENHANCED` | Blended score — AI was triggered and contributed |

This lets stewards and audit logs distinguish which technique produced the score,
enabling targeted investigation if an AI-enhanced decision is challenged.

---

## 7. What AI Catches That Statistics Miss

The following scenarios are real-world failure modes for pure statistical models
that the AI layer handles correctly.

### Scenario 1 — Cultural name reversal

| Record | First Name | Last Name | DOB | Source |
|--------|-----------|----------|-----|--------|
| A (CRM) | Wei | Zhang | 1979-04-12 | Salesforce |
| B (ERP) | Zhang | Wei | 1979-04-12 | SAP |

Statistical score: DOB is an exact match (strong), but firstName/lastName have low
JW similarity because the values are swapped. Nickname service does not cover this.
Probabilistic score ≈ 0.65 → CREATE_NEW without AI.

AI prompt response: `SCORE:0.94|REASON:Chinese name convention — family name first;
same DOB confirms same person`

Blended: `0.65 × 0.6 + 0.94 × 0.4 = 0.77` → SEND_TO_STEWARD ✓

### Scenario 2 — Transliteration variant

| Record | Name | DOB | Source |
|--------|------|-----|--------|
| A | Müller, Hans | 1963-07-22 | German ERP |
| B | Mueller, Hans | 1963-07-22 | US CRM |

Double Metaphone maps "Müller" and "Mueller" differently (umlaut handling varies by
locale). JW similarity: ~0.78. Probabilistic score ≈ 0.68.

AI: `SCORE:0.95|REASON:ü→ue is standard German transliteration; identical DOB`

Blended: `0.68 × 0.6 + 0.95 × 0.4 = 0.79` → SEND_TO_STEWARD ✓

### Scenario 3 — Post-merge name change

| Record | Name | DOB | Tax ID | Source |
|--------|------|-----|--------|--------|
| A | Elizabeth Johnson | 1988-03-01 | — | Billing |
| B | Elizabeth Chen | 1988-03-01 | — | HR System |

JW on last name: 0.00 (completely different). Probabilistic score ≈ 0.45 → below
AI trigger threshold. AI is not applied here — correctly, because statistics cannot
distinguish a married name change from two different people. This stays as CREATE_NEW
and goes to a steward via soft-match scan if tax IDs are later populated and match.

(This illustrates a non-trivial design decision: AI is not a cure-all and the trigger
range was deliberately chosen to not override near-zero statistical scores.)

---

## 8. Decision Thresholds and Actions

| Final Score | Action | What happens |
|-------------|--------|--------------|
| 1.00 (deterministic) | `AUTO_LINK` | Immediate merge; golden record updated; no review |
| ≥ 0.95 | `AUTO_LINK` | Automatic merge; survivorship rules applied |
| 0.75 – 0.94 | `SEND_TO_STEWARD` | `StewardTask` created; both records shown side-by-side with score breakdown and AI reason |
| 0.40 – 0.74 | `CREATE_NEW` | New golden record created; marked as potential duplicate |
| < 0.40 | Rejected | Not considered a match; not surfaced to stewards |

Thresholds are **configurable per MatchingRule**, allowing different thresholds for
different source systems or entity types:

```json
{
  "autoLinkThreshold": 0.90,
  "reviewThreshold": 0.70,
  "useAIEnhancement": true
}
```

---

## 9. Blocking — How Scale is Managed

Before any scoring occurs, the `BlockingKeyService` reduces the candidate pool from
all N golden records to a small set of phonetically and structurally similar records.

Without blocking, scoring 1 billion records against each other requires 5 × 10¹⁷
comparisons — physically impossible. With blocking at k = 50 candidates per record:
50 billion comparisons — tractable in real time.

### The 9 blocking strategies

| Strategy | Key format | What it captures |
|----------|-----------|-----------------|
| Double Metaphone (token) | `DM:SM0` | Phonetically similar names — "Smith", "Smyth", "Smythe" |
| Nickname variants | `DM:RBRT` | "Bob" groups with "Robert" before phonetic coding |
| Full-name collapsed DM | `DMF:JNSM0` | Compound names entered without spaces |
| First initial + last phonetic | `FI:j:SM0` | Middle-name variations, different first names |
| DOB year+month + initial | `DOB:1985-3:j` | Same birthday + initial — highly discriminating |
| Tax ID first 4 digits | `TAX:4271` | Formatting variants, partial ID overlap |
| Phone last 7 digits | `PH7:5559876` | Country/area code variants |
| Email domain + initial | `EM:gmail.com:j` | Same company email domain |
| Exact DUNS / LEI / National ID | `DUNS:0000123456` | Near-deterministic for organisations |

A true match only needs to share **one** blocking key to be retrieved. Using 9
strategies simultaneously maximises recall — the probability of missing a true match
because it landed in no bucket approaches zero.

---

## 10. Self-Learning: The EM Algorithm

The Fellegi-Sunter model requires m/u probability parameters for each attribute.
Rather than using static industry priors (which may not match your data), the engine
uses the **Expectation-Maximisation (EM) algorithm** to learn these parameters
directly from your data — without any labelled examples.

### How it works

```
Every night at 02:00 UTC:

1. Sample 5,000 random party pairs from golden records
   (random → ~99.9% are non-matches; ~0.1% are true matches)

2. E-step: For each pair, estimate P(match | observed similarities)
   using the current m/u parameters

3. M-step: Re-estimate m/u parameters to maximise the likelihood
   of those assignments

4. Repeat until convergence (‖Δm‖ + ‖Δu‖ < 10⁻⁶, max 100 iterations)

5. Apply new parameters immediately to all subsequent scoring
```

The EM algorithm ensures that a financial services firm with many shared-family-email
cases gets a higher u(email) estimate, while a healthcare firm with frequent DOB
data-entry errors gets a lower m(DOB) estimate. Parameters are continuously tuned
to your actual data.

---

## 11. Steward Feedback Loop

Every steward decision (MATCH or NO_MATCH) is captured as a `MatchingFeedback`
record containing the full 11-dimensional feature vector and the decision label.

This data feeds three separate learning loops:

| Loop | Class | Update trigger | What changes |
|------|-------|---------------|-------------|
| Reactive ML retrain | `MLMatchingService` | Every 5 new feedback records | Logistic regression weights — near-real-time soft-match suggestions |
| Nightly full pipeline | `AutoRetrainScheduler` + `ModelTrainingPipeline` | Daily at 02:30 UTC (or on demand) | Full model with k-fold CV, AUC-ROC, held-out test evaluation, version bump |
| Fellegi-Sunter parameters | `EMAlgorithmService` | Nightly at 02:00 UTC | m/u probabilities used by the probabilistic scorer |

### Reactive retrain (every 5 decisions)

`MLMatchingService.captureDecision()` increments a counter. On every fifth call it
triggers `retrainModelAsync()`, which re-runs logistic regression on all available
feedback and updates the in-memory weight vector within seconds. This keeps
soft-match suggestions fresh throughout the day without waiting for the nightly run.

### Nightly full pipeline

The `AutoRetrainScheduler` runs the complete `ModelTrainingPipeline` at 02:30 UTC.
It also performs an hourly **drift check**: if the MATCH rate in recent feedback shifts
more than 20% relative to the model's training baseline, it triggers an immediate
unscheduled retrain. See Section 12 for full pipeline details.

When a steward encounters an AI-enhanced decision, the **AI explanation** (the REASON
field extracted from the GPT-4 response) is shown alongside the statistical attribute
breakdown. This gives stewards context for why the AI considered it a match, enabling
better-informed decisions and higher-quality training data.

---

## 12. Auto-Training Pipeline

The `ModelTrainingPipeline` is a nine-stage process that runs nightly (and on demand)
to produce a rigorously evaluated, versioned model. It is entirely separate from the
lightweight reactive retrain — both co-exist.

### Pipeline stages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ModelTrainingPipeline.runPipeline(entityType, triggeredBy, triggerReason)  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Stage 1   Load steward feedback from Cosmos DB                             │
│            feedbackRepository.findByEntityType(entityType)                  │
│                                                                             │
│  Stage 1b  AI augmentation (if mode = AI or AUTO and Azure OpenAI present) │
│            AITrainingLabeler generates synthetic labels for unlabeled pairs │
│            Merged: AI labels + steward labels (steward always wins dedup)  │
│                                                                             │
│  Stage 2   FeedbackProcessorService                                         │
│            - Deduplicate: keep most recent label per party pair            │
│            - Resolve contradictions: MATCH vs NO_MATCH for same pair       │
│            - Class balance: oversample minority if majority:minority > 3:1 │
│                                                                             │
│  Stage 3   Build feature matrices X[n×11] and label vector y[n]           │
│                                                                             │
│  Stage 4   Stratified 80/20 train/test split                               │
│            (preserves MATCH/NO_MATCH ratio in both sets)                   │
│                                                                             │
│  Stage 5   5-fold cross-validation on the training set                     │
│            Reports: mean F1 ± std, per-fold accuracy                       │
│                                                                             │
│  Stage 6   Final logistic regression on complete training set              │
│            L2 regularisation, 500 iterations, log-odds bias warm-start    │
│                                                                             │
│  Stage 7   Evaluate on held-out test set                                   │
│            Computes: accuracy, precision, recall, F1, AUC-ROC             │
│            Sweeps 0.10–0.90 to find F1-maximising optimal threshold        │
│                                                                             │
│  Stage 8   Compare against currently deployed model                        │
│            PUBLISH if: ΔF1 ≥ −0.05  OR  training set 1.5× larger         │
│            RETAIN  if: new model is worse by more than 5% F1               │
│                                                                             │
│  Stage 9   Build and save MLMatchModel to Cosmos DB                        │
│            Semantic version bump vN → v(N+1)                               │
│            Sets trainingMode = "ML_ONLY" | "AI_AUGMENTED"                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Feature vector (11 dimensions)

| Feature | Description |
|---------|-------------|
| `nameSimilarity` | Composite name similarity (JW, phonetic, nickname) |
| `dobExactMatch` | Date of birth exact match (1.0 or 0.0) |
| `taxIdExactMatch` | Tax ID / EIN exact match |
| `emailMatch` | Email address match |
| `phoneMatch` | Phone number match (last 10 digits) |
| `addressSimilarity` | Address composite similarity |
| `dunsMatch` | D-U-N-S number match |
| `leiMatch` | Legal Entity Identifier match |
| `nationalIdMatch` | National ID match |
| `sourceSystemDiversity` | 1.0 if records come from different source systems |
| `partyTypeMatch` | 1.0 if both records are the same party type |

### Scheduling

| Schedule | Trigger | Condition |
|----------|---------|-----------|
| `0 30 2 * * *` (02:30 daily) | Nightly retrain | New feedback count ≥ 10 since last train |
| `0 0 * * * *` (every hour) | Drift check | MATCH rate shifted > 20% since training |
| Manual API call | On demand | `POST /api/v1/ml/matching/training/run` |

### TrainingResult response

Every pipeline execution returns a `TrainingResult` containing:

```json
{
  "success": true,
  "modelPublished": true,
  "entityType": "PARTY",
  "rawFeedbackCount": 342,
  "cleanedFeedbackCount": 318,
  "trainExamples": 255,
  "testExamples": 63,
  "duplicatesRemoved": 18,
  "contradictionsResolved": 6,
  "wasBalanced": false,
  "effectiveTrainingMode": "AI_AUGMENTED",
  "aiLabelsGenerated": 87,
  "crossValidation": {
    "folds": 5,
    "meanF1": 0.891,
    "stdF1": 0.023
  },
  "testEvaluation": {
    "accuracy": 0.905,
    "precision": 0.912,
    "recall": 0.887,
    "f1": 0.899,
    "auc": 0.943,
    "optimalThreshold": 0.48
  },
  "comparison": {
    "recommendation": "PUBLISH",
    "reason": "F1 improved from 0.871 to 0.899 (+0.028)"
  },
  "publishedModelVersion": "v7",
  "effectiveTrainingMode": "AI_AUGMENTED",
  "message": "Model v7 published: F1=0.899 mode=AI_AUGMENTED"
}
```

---

## 13. Configurable Training Mode: ML vs AI

The matching model can be trained in two modes, controlled by a single configuration
property. This is the key switch for opting into AI-augmented training.

### Training modes

| Mode | Value | Behaviour |
|------|-------|-----------|
| **ML only** | `ML` | Train exclusively on human steward decisions. Safe, fully explainable, no OpenAI API calls during training. |
| **AI augmented** | `AI` | Steward decisions + GPT-4-generated synthetic labels for unlabeled golden-record pairs. Requires `averio.ai.enabled=true`. |
| **Auto** | `AUTO` *(default)* | Uses AI augmentation if Azure OpenAI is configured at runtime; silently falls back to ML if not. |

Setting `TRAINING_MODE=ML` is a hard guarantee — the pipeline will never call GPT-4
during training regardless of AI configuration.

### How AI label generation works

When mode is `AI` or `AUTO` and Azure OpenAI is configured, the `AITrainingLabeler`
runs as Stage 1b of the pipeline:

```
1. Load all existing steward-labeled pair keys (to never override human decisions)

2. Load all golden records of the entity type from Neo4j

3. Use BlockingKeyService to discover candidate pairs — same O(N×k) strategy
   used by the matching engine itself (avoids brute-force O(N²) enumeration)

4. Filter out pairs already labeled by stewards

5. Shuffle with fixed seed (42) and sample up to aiLabelSampleSize pairs

6. For each pair, call GPT-4 with temperature=0.0 (fully deterministic):
   - Score >= aiMatchThreshold (0.70)   → label MATCH
   - Score <= aiNoMatchThreshold (0.30) → label NO_MATCH
   - Score in between                   → pair discarded (uncertain, skip)

7. Build MatchingFeedback records with:
   - decisionSource = "AI_GENERATED"
   - decidedAt     = 2020-01-01 (deliberately old timestamp)

8. Merge AI labels + steward labels. FeedbackProcessorService deduplicates
   by keeping the most recent label per pair. Steward labels use real timestamps
   (recent) → always win over AI labels (2020-01-01) for any pair where both exist.
```

The AI labels are **never persisted to Cosmos DB** — they are generated fresh in
memory for each pipeline run. This keeps the permanent feedback store clean and
human-decision-only.

### The ratio cap

To prevent AI-generated labels from dominating the training set:

```
maxAiLabels = ceil(stewardFeedbackCount × aiLabelMaxRatio)
```

With the default `aiLabelMaxRatio = 0.40`, AI labels can account for at most 40% of
the total training data. Steward labels always fill first; AI labels fill the
remainder up to this cap.

| Steward labels | Max AI labels (40% cap) | Max training set size |
|----------------|------------------------|-----------------------|
| 100 | 40 | 140 |
| 500 | 200 | 700 |
| 1,000 | 400 | 1,400 |

### Model audit trail

Every published `MLMatchModel` carries a `trainingMode` field that records exactly
how it was trained:

| `trainingMode` | Meaning |
|----------------|---------|
| `ML_ONLY` | Trained on steward feedback only |
| `AI_AUGMENTED` | Steward feedback + GPT-4 synthetic labels |
| `null` | Model trained before this field was introduced (backward-compatible) |

This is visible in `GET /api/v1/ml/matching/model?entityType=PARTY` and in every
`TrainingResult.effectiveTrainingMode` returned by the training API.

### Prompt used for training labels

The same structured prompt format is used for both **matching** (AIEnhancedMatcher)
and **training label generation** (AITrainingLabeler):

```
You are an expert in entity resolution for Master Data Management.
Determine if the following two party records represent the same real-world entity.

Record A:
- Name: {firstName} {lastName}
- Organization: {organizationName}
- DOB: {dateOfBirth}
- Tax ID: {taxId}
- Source: {sourceSystem}

Record B:
- Name: {firstName} {lastName}
- Organization: {organizationName}
- DOB: {dateOfBirth}
- Tax ID: {taxId}
- Source: {sourceSystem}

Respond with ONLY: SCORE:<0.00-1.00>|REASON:<brief explanation>
```

**Temperature:** `0.0` for training labels (maximally deterministic — same pair
always gets the same label across runs). Compare to `0.1` for live matching.

---

## 14. Training API Reference

All endpoints are under `/api/v1/ml/matching/training/`.

### GET `/training/status`

Returns the health of all entity-type models, feedback counts, drift metrics,
and the 5 most recent run records per entity type.

```json
{
  "PARTY": {
    "modelVersion": "v7",
    "f1Score": 0.899,
    "trainingExamples": 318,
    "trainedAt": "2026-05-31T02:31:44",
    "trainingMode": "AI_AUGMENTED",
    "feedbackSinceLastTrain": 12,
    "recentRuns": [...]
  }
}
```

### POST `/training/run?entityType=PARTY&triggeredBy=API_USER`

Synchronously executes the full 9-stage pipeline and returns a complete
`TrainingResult` (see Section 12 for the response structure). Useful for
on-demand retraining after a bulk import of steward decisions.

### GET `/training/history?entityType=PARTY`

Returns the last 50 run records (in-memory, resets on restart). Each record
includes trigger reason, success/failure, model published, and key metrics.

### GET `/training/config`

Returns the active training configuration and whether AI augmentation is
available at runtime:

```json
{
  "configuredMode": "AUTO",
  "effectiveMode": "AI_AUGMENTED",
  "aiLabelerAvailable": true,
  "aiLabelSampleSize": 100,
  "aiLabelMaxRatio": 0.40,
  "aiMatchThreshold": 0.70,
  "aiNoMatchThreshold": 0.30,
  "description": "AI_AUGMENTED — GPT-4 will label unlabeled golden-record pairs..."
}
```

When `aiLabelerAvailable` is `false`, `effectiveMode` will be `ML_ONLY` regardless
of `configuredMode`. To enable AI augmentation, set `averio.ai.enabled=true` with
valid Azure OpenAI credentials.

---

## 15. Configuration Reference

### application.yml

```yaml
averio:
  matching:
    auto-link-threshold: 0.95      # Score >= this → AUTO_LINK
    review-threshold: 0.75          # Score >= this → SEND_TO_STEWARD
    auto-reject-threshold: 0.40     # Score < this → not considered
    ai-enhancement-enabled: true    # Global enable/disable for AI layer
    ai-enhancement-range:           # Score range that triggers AI
      min: 0.50
      max: 0.90
    blocking:
      index-on-startup: true
      rebuild-cron: "0 0 3 * * SUN" # Weekly full rebuild
    em:
      enabled: true
      sample-size: 5000
      max-iterations: 100
      schedule-cron: "0 0 2 * * *"  # Nightly at 02:00

    # ── ML / AI Training Mode ────────────────────────────────────────────
    # mode: ML   — steward labels only (safe, explainable, no OpenAI API calls)
    # mode: AI   — steward labels + GPT-4 synthetic labels (requires ai.enabled=true)
    # mode: AUTO — AI if Azure OpenAI is present, otherwise ML (default)
    training:
      mode: ${TRAINING_MODE:AUTO}
      ai-label-sample-size: ${AI_LABEL_SAMPLE_SIZE:100}   # Max GPT-4 calls per training run
      ai-label-max-ratio: ${AI_LABEL_MAX_RATIO:0.40}      # AI labels ≤ 40% of training data
      ai-match-threshold: ${AI_MATCH_THRESHOLD:0.70}      # GPT-4 score >= this → MATCH
      ai-no-match-threshold: ${AI_NO_MATCH_THRESHOLD:0.30} # GPT-4 score <= this → NO_MATCH

  ai:
    enabled: ${AI_ENABLED:false}                          # Master switch for all AI features
    deployment-name: ${AZURE_OPENAI_DEPLOYMENT:gpt-4}    # Azure OpenAI deployment name
```

### Per-rule overrides (MatchingRule)

```json
{
  "ruleName": "High-trust financial records",
  "autoLinkThreshold": 0.90,
  "reviewThreshold": 0.70,
  "useAIEnhancement": true,
  "weights": [
    { "attributeName": "taxId",    "weight": 2.0 },
    { "attributeName": "lastName", "weight": 1.5 }
  ]
}
```

---

## 16. Enabling Azure OpenAI

The AI enhancement layer requires an Azure OpenAI resource with a GPT-4 deployment.

### Setup

1. Create an Azure OpenAI resource in the Azure Portal
2. Deploy a model with ID `gpt-4` (or note your deployment name)
3. Retrieve the endpoint URL and API key
4. Configure in `application-local.yml` (never commit):

```yaml
spring:
  ai:
    azure:
      openai:
        endpoint: https://<your-resource>.openai.azure.com/
        api-key: <your-key>

averio:
  ai:
    deployment-name: gpt-4
```

For production, set `AZURE_OPENAI_KEY` as an App Service environment variable.

### Verifying AI is active

On startup, the application logs:

```
INFO  AIEnhancedMatcher - AI matching component initialised with deployment: gpt-4
```

If Azure OpenAI is not configured, no log line appears and all matches proceed
through stages 1 and 2 only — the system is fully functional without AI.

Confirm whether the training AI is also active by calling:

```
GET /api/v1/ml/matching/training/config
→ "aiLabelerAvailable": true   ← AI training augmentation is live
→ "aiLabelerAvailable": false  ← training falls back to ML_ONLY
```

### Cost estimation — live matching

AI is invoked only for borderline candidates (score 0.50–0.90). In a typical
deployment where 3–8% of incoming records land in this zone:

| Daily ingestion | % borderline | ~AI calls/day | Estimated cost |
|----------------|-------------|---------------|----------------|
| 10,000 records | 5% | ~500 | ~$0.15 (GPT-4 input pricing) |
| 100,000 records | 5% | ~5,000 | ~$1.50 |
| 1,000,000 records | 5% | ~50,000 | ~$15.00 |

*Estimates based on ~300 input tokens per prompt. Actual costs depend on Azure pricing.*

### Cost estimation — AI training augmentation

Training label generation runs once per nightly training cycle and is capped at
`aiLabelSampleSize` calls (default 100):

| `aiLabelSampleSize` | Estimated cost per run |
|--------------------|------------------------|
| 50 | ~$0.05 |
| 100 *(default)* | ~$0.10 |
| 500 | ~$0.50 |

Set `TRAINING_MODE=ML` to disable training API calls entirely with zero cost impact
on live matching.

---

## 17. Tuning the AI Layer

### Widening the trigger zone

**Current default:** 0.50 < score < 0.90

Widening to `0.40 < score < 0.95` catches more borderline cases but increases API
cost and latency. Consider this when:
- Your data has high variance (many cultural name formats, transliterations)
- Steward review volume is low and AUTO_LINK misses are costly

### Narrowing the trigger zone

Narrowing to `0.60 < score < 0.85` reduces cost and latency. Consider this when:
- Azure OpenAI latency is adding too much to end-to-end match time
- Your data is clean, well-formatted, English-only

### Adjusting the blend weight

The 60/40 blend is hardcoded in `MatchingEngine.evaluateMatch()`:

```java
finalScore = probabilisticScore.getScore() * 0.6 + aiScore.getScore() * 0.4;
```

To increase AI influence (e.g., 50/50), change to:

```java
finalScore = probabilisticScore.getScore() * 0.5 + aiScore.getScore() * 0.5;
```

**Caution:** Increasing AI weight beyond 50% makes the final score harder to audit
and explain. We recommend keeping probabilistic weight dominant.

### Disabling AI for specific rules

Set `useAIEnhancement: false` on any `MatchingRule` to disable AI for that rule's
scope (e.g., disable AI for a known-clean internal data feed to save cost):

```json
{
  "ruleName": "Internal ERP — high quality",
  "useAIEnhancement": false
}
```

---

---

*Averio MDM Engineering. For technical architecture detail see [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md).*
*Sections 12–14 document features added in the 2026-05-31 release: Auto-Training Pipeline, Configurable ML/AI Training Mode, and the Training API.*
