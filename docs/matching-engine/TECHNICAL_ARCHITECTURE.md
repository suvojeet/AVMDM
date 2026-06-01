# Averio MDM — Matching Engine: Technical Architecture

> **Audience:** Software engineers, data architects, DevOps, and technical reviewers.  
> **Last updated:** 2026-05-18  
> **Version:** 2.0 (Fellegi-Sunter + EM + Blocking)

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture Diagram](#2-system-architecture-diagram)
3. [Component Inventory](#3-component-inventory)
4. [Blocking & Candidate Generation](#4-blocking--candidate-generation)
5. [Fellegi-Sunter Probabilistic Model](#5-fellegi-sunter-probabilistic-model)
6. [EM Algorithm — Self-Learning Parameters](#6-em-algorithm--self-learning-parameters)
7. [Feature Vector (30 Dimensions)](#7-feature-vector-30-dimensions)
8. [Similarity Functions Library](#8-similarity-functions-library)
9. [Name Intelligence Services](#9-name-intelligence-services)
10. [Cluster Merge (Transitive Closure)](#10-cluster-merge-transitive-closure)
11. [Scoring Pipeline — End-to-End Flow](#11-scoring-pipeline--end-to-end-flow)
12. [Decision Thresholds & Actions](#12-decision-thresholds--actions)
13. [ML Model (Logistic Regression Layer)](#13-ml-model-logistic-regression-layer)
14. [Performance Characteristics](#14-performance-characteristics)
15. [Configuration Reference](#15-configuration-reference)
16. [API Endpoints](#16-api-endpoints)
17. [Extension Points](#17-extension-points)

---

## 1. Overview

The Averio MDM Matching Engine resolves whether two party records from different source systems represent the **same real-world entity** (person, organisation, household, or employee). It produces a **Golden Record** — the single authoritative version of that entity — by merging surviving attributes across all contributing source records.

The engine is designed to operate correctly at **trillion-record scale** using a three-tier architecture:

| Tier | Component | Complexity |
|------|-----------|------------|
| Blocking | `BlockingKeyService` | O(N × k), k ≈ 10–100 |
| Scoring | `ProbabilisticMatcher` | O(k) per incoming record |
| Clustering | `ClusterMergeService` | O(N × α(N)) ≈ O(N) |

---

## 2. System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SOURCE SYSTEMS                                  │
│   CRM (Salesforce)  │  ERP (SAP)  │  Billing  │  External Data Feed  │
└──────────────┬───────────────┬────────────────────────────────────────┘
               │               │  Incoming party record
               ▼               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      MATCHING ENGINE PIPELINE                           │
│                                                                         │
│  Step 1 ── BLOCKING ─────────────────────────────────────────────────  │
│  BlockingKeyService                                                     │
│    ├── DoubleMetaphone on name tokens          "DM:SM0"                │
│    ├── Nickname variants (Bob→Robert)          "DM:RBRT"               │
│    ├── Full-name collapsed DM code             "DMF:JNSM0"             │
│    ├── First-initial + last-name phonetic      "FI:j:SM0"              │
│    ├── DOB year+month + name initial           "DOB:1985-3:j"          │
│    ├── Tax ID / EIN first 4 digits             "TAX:4271"              │
│    ├── Phone last 7 digits                     "PH7:5559876"           │
│    ├── Email domain + name initial             "EM:gmail.com:j"        │
│    ├── Postal code prefix + name phonetic      "ZIP:10001:SM0"         │
│    └── Exact DUNS / LEI / National ID          "DUNS:0000123456"       │
│    Result: O(N²) → O(N × k) where k ≈ 10–100                         │
│                                                                         │
│  Step 2 ── DETERMINISTIC CHECK ─────────────────────────────────────  │
│  DeterministicMatcher                                                   │
│    Exact match on: SSN, TaxID, EIN, LEI, DUNS, NationalID, Email      │
│    → Score 1.0, action AUTO_LINK immediately                           │
│                                                                         │
│  Step 3 ── PROBABILISTIC SCORING (Fellegi-Sunter) ─────────────────   │
│  ProbabilisticMatcher                                                   │
│    ├── EMAlgorithmService   ← EM-learned m/u parameters                │
│    ├── NicknameService      ← "Bob"≈"Robert" (0.90)                    │
│    ├── NameNormalizerService← "IBM Corp." → "ibm" before compare      │
│    └── SimilarityFunctions  ← JW, DL, TF-IDF Cosine, Monge-Elkan,    │
│                               Token Sort/Set, Bigram Jaccard, DM       │
│    25+ attribute comparisons → log-likelihood score ∈ [0, 1]          │
│                                                                         │
│  Step 4 ── AI ENHANCEMENT (optional) ──────────────────────────────   │
│  AIEnhancedMatcher (GPT-4 blend)                                        │
│    Applied only when score ∈ [0.50, 0.90] (borderline zone)            │
│    Final = 0.6 × probabilistic + 0.4 × AI                             │
│                                                                         │
│  Step 5 ── CLUSTER MERGE (transitive closure) ─────────────────────   │
│  ClusterMergeService (Union-Find DSU)                                   │
│    A ≈ B  AND  B ≈ C  →  {A, B, C} → ONE golden record               │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       DECISION / ACTION                                 │
│                                                                         │
│   Score ≥ 0.95  →  AUTO_LINK     (automatic merge, no human needed)   │
│   Score ≥ 0.75  →  SEND_TO_STEWARD  (human review queue)              │
│   Score  < 0.75  →  CREATE_NEW   (new golden record)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
               │
               ▼
      GOLDEN RECORD (Neo4j + Cosmos DB)
```

---

## 3. Component Inventory

| Class | Package | Role |
|-------|---------|------|
| `MatchingEngine` | `engine.matching` | Orchestrator — routes through blocking → deterministic → probabilistic → AI |
| `BlockingKeyService` | `engine.matching` | Inverted-index blocking; 9 key strategies; nickname + normalised name keys |
| `DeterministicMatcher` | `engine.matching` | Exact identifier matching (SSN, TaxID, Email, etc.) |
| `ProbabilisticMatcher` | `engine.matching` | Fellegi-Sunter log-likelihood scorer; uses EM parameters |
| `AIEnhancedMatcher` | `engine.matching` | GPT-4 blend for borderline [0.50, 0.90] zone |
| `SimilarityFunctions` | `engine.matching` | Algorithms: JW, DL, TF-IDF Cosine, Monge-Elkan, Bigram/Trigram Jaccard, DM |
| `NicknameService` | `engine.matching` | 90+ English name equivalence groups (Bob↔Robert) |
| `NameNormalizerService` | `engine.matching` | Legal suffix stripping, address abbreviations, salutation removal |
| `EMAlgorithmService` | `engine.matching` | Unsupervised EM for learning m/u probabilities; nightly scheduler |
| `ClusterMergeService` | `engine.matching` | Union-Find transitive closure for golden record clustering |
| `FeatureExtractorService` | `service.ml` | Extracts 30-dimensional feature vector from party pairs |
| `MLMatchingService` | `service.ml` | Logistic regression model; blocking-accelerated soft-match scan |

---

## 4. Blocking & Candidate Generation

### Why Blocking is Mandatory

At N = 1,000,000,000 records:
- Naïve O(N²) = 5 × 10¹⁷ comparisons → **physically impossible**
- With blocking at k = 50: 50,000,000 comparisons → **tractable**

### 9 Blocking Strategies (Union = Maximum Recall)

Each strategy generates different keys; the union of all matching buckets forms the candidate set. Using multiple strategies maximises recall — a true match only needs to share **one** blocking key to be retrieved.

```
Strategy 1  DM:<code>        Double Metaphone on each name token
            "John Smith" → keys: DM:JN, DM:SM0
            Recall: captures spelling variants, typos, phonetically similar names

Strategy 1b DM:<code>        Nickname variant keys
            "Bob Smith" → also generates DM:RBRT (Robert's code)
            Recall: cross-system name variants (CRM uses "Bob", ERP uses "Robert")

Strategy 2  DMF:<code>       Full collapsed-name Double Metaphone
            "JohnSmith" → DMF:JNSM0
            Recall: compound names, names entered without spaces

Strategy 3  FI:<c>:<code>    First initial + last-token phonetic
            "J" + DM("Smith") → FI:j:SM0
            Recall: middle-name variations, different first names with same last

Strategy 4  DOB:<y>-<m>:<c> DOB year+month + name initial
            1985-03 + "J" → DOB:1985-3:j
            Recall: same birthday + same initial — very discriminating

Strategy 5  TAX:<4digits>    First 4 digits of Tax ID / EIN
            "427-12-3456" → TAX:4271
            Recall: hyphen/formatting variants, partial ID overlap

Strategy 6  PH7:<7digits>    Phone last 7 digits
            "+1 (212) 555-9876" → PH7:5559876
            Recall: country code variants, area code reassignment

Strategy 7  EM:<domain>:<c>  Email domain + name initial
            "j@gmail.com" → EM:gmail.com:j
            Recall: same company email domain, different address format

Strategy 8  ZIP:<zip>:<code> Postal code prefix + name phonetic
            "10001" + DM("John") → ZIP:10001:JN
            Recall: nearby addresses, same-building entities

Strategy 9  DUNS/LEI/NID     Exact high-cardinality identifiers
            "DUNS:0000123456" (near-deterministic)
            Recall: perfect for organisations with standard identifiers
```

### Inverted Index Data Structure

```
ConcurrentHashMap<String, Set<String>>
     │                       │
   blocking_key           globalIds in this bucket

Plus:
ConcurrentHashMap<String, Set<String>>
     │                       │
   globalId             its blocking keys (for O(1) removal on merge/delete)
```

**Memory footprint:** ~1 GB per 10 million golden records (estimated at ~100 bytes per globalId × average 10 keys per party).

**For trillion-scale production:** Replace `ConcurrentHashMap` with Redis Hashes. The `BlockingKeyService` API is backend-agnostic — callers see only `findCandidates()` / `indexParty()`.

---

## 5. Fellegi-Sunter Probabilistic Model

### Theoretical Foundation

Ivan Fellegi and Alan Sunter (1969) proved that the optimal record linkage decision rule is a likelihood ratio test. For a pair of records (a, b):

```
Λ(a,b) = P(comparison_vector | M) / P(comparison_vector | U)

Where:
  M = the event "a and b represent the same entity"
  U = the event "a and b represent different entities"
```

### Per-Attribute Log-Likelihood Weight

For each attribute k with agreement score aₖ ∈ [0, 1]:

```
wₖ = aₖ × ln(mₖ / uₖ)  +  (1 − aₖ) × ln((1 − mₖ) / (1 − uₖ))

Where:
  mₖ = P(attribute k agrees | true match)     — from EM algorithm
  uₖ = P(attribute k agrees | non-match)       — from EM algorithm
  aₖ = continuous agreement score [0, 1]        — from SimilarityFunctions

Note: aₖ × (agree_weight) + (1−aₖ) × (disagree_weight) is the
      expected weight under the EM mixture model.
```

### Score Normalisation

```
raw_score   = Σ wₖ  (over all available attributes)
max_score   = Σ ln(mₖ / uₖ)            (all attributes fully agree)
min_score   = Σ ln((1−mₖ) / (1−uₖ))   (all attributes fully disagree)

final_score = (raw_score − min_score) / (max_score − min_score)  ∈ [0, 1]
```

### Attribute m/u Parameter Table (initial priors, overridden by EM)

| Attribute | m (P agree\|match) | u (P agree\|non-match) | Discriminating power |
|-----------|-------------------|------------------------|----------------------|
| SSN | 0.999 | 0.00001 | Extremely high |
| Tax ID / EIN | 0.999 | 0.0001 | Extremely high |
| DUNS | 0.999 | 0.0001 | Extremely high |
| LEI | 0.999 | 0.0001 | Extremely high |
| Email (exact) | 0.920 | 0.002 | Very high |
| Date of Birth | 0.980 | 0.003 | Very high |
| Phone (exact) | 0.880 | 0.003 | High |
| Last name (JW) | 0.950 | 0.006 | High |
| First name (JW) | 0.920 | 0.012 | High |
| Nickname match | 0.880 | 0.005 | High |
| Last name phonetic | 0.920 | 0.018 | Medium-high |
| Org name (JW) | 0.900 | 0.005 | High |
| Postal code | 0.870 | 0.028 | Medium |
| City | 0.850 | 0.030 | Medium |
| Email domain | 0.700 | 0.040 | Low-medium |

---

## 6. EM Algorithm — Self-Learning Parameters

### Problem with Fixed Priors

Hardcoded m/u values are industry estimates. Your actual data has different characteristics:
- A financial services firm may have many duplicate emails (shared family accounts) → u(email) should be higher
- A healthcare company may have more DOB errors → m(DOB) should be lower

### The EM Algorithm (Winkler 1988 extension of Fellegi-Sunter)

```
INPUT:  Sample of N random comparison pairs from golden records
        (random → mostly non-matches by nature, since P(match) ≈ 0.1%)

INITIALISE: m[] = domain priors, u[] = domain priors, π = 0.001

REPEAT until convergence (‖Δm‖ + ‖Δu‖ + |Δπ| < ε):

  E-step: For each comparison pair i, compute posterior:
    P(match | γᵢ) = π × Π_k [ mₖ^γᵢₖ × (1−mₖ)^(1−γᵢₖ) ]
                  / [ π × P(γᵢ|M) + (1−π) × P(γᵢ|U) ]
    (computed in log-space to avoid numerical underflow)

  M-step: Update parameters using weighted sums:
    mₖ_new = Σᵢ P(match|γᵢ) × γᵢₖ  /  Σᵢ P(match|γᵢ)
    uₖ_new = Σᵢ P(non-match|γᵢ) × γᵢₖ  /  Σᵢ P(non-match|γᵢ)
    π_new  = Σᵢ P(match|γᵢ)  /  N

OUTPUT: Learned m[], u[], π  for this party type

SCHEDULE: Nightly at 02:00 via @Scheduled(cron = "0 0 2 * * *")
SAMPLE SIZE: 5,000 pairs (statistically sufficient; more ≈ diminishing returns)
MAX ITERATIONS: 100 (convergence typically at 20–40 iterations)
```

### Fallback Behaviour

If EM has not yet run (cold start, or insufficient data):
- Falls back to hardcoded domain priors
- Sanity check: if learned m ≤ u, reverts to prior (prevents degenerate solutions)

---

## 7. Feature Vector (30 Dimensions)

### Core 11 Features — ML Model Training

These features are stored in `MatchingFeedback` and used to train/retrain the logistic regression model.

| # | Feature | Computation |
|---|---------|-------------|
| 1 | `nameSimilarity` | Jaro-Winkler on primary name |
| 2 | `dobExactMatch` | Exact date match (0 or 1) |
| 3 | `taxIdExactMatch` | Exact taxId/EIN/SSN match |
| 4 | `emailMatch` | Exact email match across all email maps |
| 5 | `phoneMatch` | Normalised digit match (last 10 digits) |
| 6 | `addressSimilarity` | JW on concatenated address string |
| 7 | `dunsMatch` | Exact DUNS match |
| 8 | `leiMatch` | Exact LEI match |
| 9 | `nationalIdMatch` | Exact passport / national ID match |
| 10 | `sourceSystemDiversity` | 1.0 if from different source systems |
| 11 | `partyTypeMatch` | 1.0 if same party type |

### Extended 19 Features — Fellegi-Sunter Probabilistic Scorer

Not stored in feedback; available in feature map with `ext_` prefix.

| # | Feature | Computation |
|---|---------|-------------|
| 12 | `ext_firstNameJW` | JW on first name only |
| 13 | `ext_lastNameJW` | JW on last name only |
| 14 | `ext_firstNamePhonetic` | Double Metaphone on first name |
| 15 | `ext_lastNamePhonetic` | Double Metaphone on last name |
| 16 | `ext_nameTokenSort` | Token Sort Ratio on full name |
| 17 | `ext_nameTokenSet` | Token Set Ratio on full name |
| 18 | `ext_nameBigram` | Bigram Jaccard on full name |
| 19 | `ext_orgTokenSort` | Token Sort Ratio on org name |
| 20 | `ext_orgTokenSet` | Token Set Ratio on org name |
| 21 | `ext_orgBigram` | Bigram Jaccard on org name |
| 22 | `ext_dobYearMatch` | Year-only DOB match (0, 0.6, or 1.0) |
| 23 | `ext_dobPartial` | Partial DOB with transposition detection |
| 24 | `ext_postalCodeSim` | Postal code string similarity |
| 25 | `ext_citySim` | City name composite similarity |
| 26 | `ext_addressPostalExact` | Exact postal code match (0 or 1) |
| 27 | `ext_phoneLast7` | Last 7 phone digits match |
| 28 | `ext_emailDomain` | Same email domain (0 or 1) |
| 29 | `ext_partySubTypeMatch` | Exact subtype match (0 or 1) |
| 30 | `ext_ssnMatch` | Exact SSN match (stored encrypted) |

---

## 8. Similarity Functions Library

All functions return a normalised similarity in [0, 1].

### Jaro-Winkler (JW)
- **When:** General string similarity; prefix-sensitive
- **Best for:** Short names where prefix matters ("Smith" vs "Smithson")
- **Not for:** Long org names with word-order variations

### Damerau-Levenshtein (OSA)
- **When:** Names with transpositions (most common human typing error)
- **Best for:** "Jonh" → "John" (1 edit, not 2); "Robert" → "Robret"
- **Formula:** `1 − OSA_distance / max(len_a, len_b)`

### Token Sort Ratio
- **When:** Same words, different order
- **Best for:** "Smith John" vs "John Smith"; "General Electric" vs "Electric General"
- **How:** Sort tokens alphabetically, then run JW

### Token Set Ratio
- **When:** Superset/subset name variations
- **Best for:** "International Business Machines Corporation" vs "IBM Corp"
- **How:** max(Jaccard over tokens, JW over sorted token strings)

### Bigram Jaccard
- **When:** Robust to insertions/typos
- **Best for:** "Jonathan" vs "Johnathan" (insertion); "Smyth" vs "Smith"
- **Formula:** |bigram_set_a ∩ bigram_set_b| / |bigram_set_a ∪ bigram_set_b|

### TF-IDF Cosine (character n-grams)
- **When:** Long organisation names with many tokens
- **Best for:** "Bank of America National Association" vs "Bank of America NA"
- **How:** 2-gram term-frequency cosine similarity

### Monge-Elkan (symmetric)
- **When:** Different numbers of tokens, or abbreviated tokens
- **Best for:** "John M. Smith Jr." vs "J. Smith"; "Microsoft Corp" vs "Microsoft"
- **How:** For each token in A, find max JW to any token in B; average both directions

### Double Metaphone
- **When:** Phonetic equivalence across spelling variants
- **Best for:** "Smith" / "Smythe" / "Smyth" → all map to "SM0"
- **Why DM over Soundex:** Handles English AND foreign-origin names; has alternate codes

---

## 9. Name Intelligence Services

### NicknameService — 90+ Equivalence Groups

```
Robert  ↔  Bob, Bobby, Rob, Robbie, Bert
William ↔  Bill, Billy, Will, Willy, Liam
Elizabeth↔ Liz, Lizzie, Beth, Betsy, Betty, Eliza, Lisa, Libby
...
```

**Impact:** Without this service, "Bob Smith" in CRM and "Robert Smith" in ERP would fail to match on first-name comparison — a common failure mode in enterprise MDM.

**Similarity scores:**
- Same name (after normalisation): 1.0
- Known nickname pair: 0.90
- Not related: 0.0

**Blocking integration:** BlockingKeyService generates DM codes for ALL nickname variants, ensuring that records with different nickname forms land in the same blocking bucket.

### NameNormalizerService — Three Pipelines

**`normaliseOrg(name)`**
```
"IBM Corporation, The"     → "ibm"
"Acme Corp. & Associates"  → "acme associates"
"Bank of America, N.A."    → "bank america"
```
Strips: `inc`, `corp`, `corporation`, `llc`, `ltd`, `limited`, `plc`, `gmbh`, `ag`, `sa`, `bv`, `co`, `the`, `and` (and 20+ more)

**`normaliseIndividual(name)`**
```
"Dr. John R. Smith Jr."    → "john r smith"
"Mrs. Elizabeth Johnson"   → "elizabeth johnson"
```
Strips: `mr`, `mrs`, `ms`, `dr`, `prof`, `rev`, `jr`, `sr`, `ii`, `iii`, `iv`, `esq`, `phd`, `md`

**`normaliseAddress(line)`**
```
"123 North Main Street, Suite 4B"  → "123 n main st ste 4b"
"456 Boulevard East, Apt 12"       → "456 blvd e apt 12"
```

---

## 10. Cluster Merge (Transitive Closure)

### Why Pairwise Matching is Insufficient

Pairwise matching gives you match pairs: `{(A,B), (B,C)}`. Without transitive closure:
- A and B get one golden record
- B and C get another golden record
- But B appears in both → **two golden records for the same entity**

### Union-Find Algorithm

```java
// Path compression + union by rank
// O(α(N)) per operation, where α = inverse Ackermann ≈ effectively O(1)

for each match pair (id1, id2) where score ≥ LINK_THRESHOLD:
    unionFind.union(id1, id2)

clusters = unionFind.getClusters()
// Returns: { root_id → Set<member_ids> }
```

### Example

```
Match pairs: (A,B)=0.97, (B,C)=0.95, (D,E)=0.98, (F,G)=0.62 (below threshold)

After union-find:
  Cluster 1: {A, B, C} → one golden record (root = A or B)
  Cluster 2: {D, E}    → one golden record
  Cluster 3: {F}       → singleton
  Cluster 4: {G}       → singleton
```

---

## 11. Scoring Pipeline — End-to-End Flow

```
1. Incoming party record arrives
          │
2. BlockingKeyService.generateKeys(party)
   → Set<String> blockingKeys (9 strategies + nickname variants)
          │
3. BlockingKeyService.findCandidates(party)
   → Set<String> candidateGlobalIds  (O(k) lookup from inverted index)
          │
4. Fetch Party objects for each candidateGlobalId from PartyRepository
   (only k records fetched, not all N)
          │
5. For each candidate:
   a. DeterministicMatcher.score(incoming, candidate, rule)
      → if definiteMatch → MatchCandidate(score=1.0, DETERMINISTIC)
      → else continue to step b
   
   b. FeatureExtractorService.extract(incoming, candidate)
      → Map<String, Double> features (30 dimensions)
   
   c. ProbabilisticMatcher.score(incoming, candidate, rule):
      i.  EMAlgorithmService.getParameters(partyType) → m[], u[]
      ii. For each attribute k:
          - Compute agreement score aₖ using SimilarityFunctions
          - Apply NicknameService boost for first/last name
          - Apply NameNormalizerService for org/individual name
          - Compute FS weight: wₖ = aₖ×ln(m/u) + (1−aₖ)×ln((1−m)/(1−u))
      iii. Normalise: finalScore = (raw−min) / (max−min)
      → MatchScore(score, attributeBreakdown)
   
   d. If rule.useAIEnhancement AND score ∈ [0.50, 0.90]:
      → AIEnhancedMatcher.score(incoming, candidate)
      → finalScore = 0.6×probabilistic + 0.4×AI
          │
6. Filter candidates: score > AUTO_REJECT_THRESHOLD (0.40)
   Sort by score descending
          │
7. MatchingEngine.determineAction(candidates, rule):
   bestScore ≥ 0.95 → AUTO_LINK
   bestScore ≥ 0.75 → SEND_TO_STEWARD
   bestScore  < 0.75 → CREATE_NEW
          │
8. Return MatchResult { incomingParty, candidates, action, bestMatchScore }
```

---

## 12. Decision Thresholds & Actions

| Score Range | Action | Description |
|-------------|--------|-------------|
| 0.95 – 1.00 | `AUTO_LINK` | Merge automatically; update golden record; no human review |
| 0.75 – 0.94 | `SEND_TO_STEWARD` | Create `StewardTask`; human reviews before merge |
| 0.40 – 0.74 | `CREATE_NEW` | Create new golden record; party marked as potential duplicate |
| 0.00 – 0.39 | Rejected | Score below AUTO_REJECT threshold; not considered a match |

### Custom Thresholds via MatchingRule

```json
{
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

## 13. ML Model (Logistic Regression Layer)

The logistic regression model runs **alongside** the Fellegi-Sunter scorer and provides:
1. **Soft-match suggestions** — proactively surfaces potential duplicates for steward review
2. **Score calibration** — can be blended with FS score when sufficient training data exists

### Architecture

```
Features (11-dim) → Logistic Regression (gradient descent, L2 regularisation)
                  → sigmoid(w·x) → P(match) ∈ [0, 1]
```

### Training Parameters
- **Algorithm:** Batch gradient descent
- **Iterations:** 500
- **Learning rate:** 0.1
- **Regularisation:** L2, λ = 0.01
- **Trigger:** Auto-retrain every 5 new steward feedback decisions

### Soft-Match Scan (blocking-accelerated)
- **Previous complexity:** O(N²) — catastrophic at scale
- **Current complexity:** O(N × k) via BlockingKeyService
  - For each golden record, look up its candidate set (k records)
  - Score only candidate pairs, not all possible pairs
  - 10,000× speedup at N = 1,000,000

---

## 14. Performance Characteristics

| Scale | N golden records | Blocking time | Scoring time | Total per record |
|-------|-----------------|---------------|--------------|-----------------|
| Small | 100K | < 1 ms | ~5 ms (k=50 × 0.1ms) | ~6 ms |
| Medium | 10M | < 2 ms | ~10 ms | ~12 ms |
| Large | 100M | < 5 ms | ~50 ms | ~55 ms |
| XL | 1B | < 10 ms | ~100 ms | ~110 ms |

*Assumes k (average bucket size) ≈ 50–200 candidates post-blocking.*

### Memory Requirements (in-memory blocking index)

| N golden records | Index memory |
|-----------------|--------------|
| 1M | ~100 MB |
| 10M | ~1 GB |
| 100M | ~10 GB (consider Redis backing) |
| 1B+ | External Redis / Elasticsearch required |

---

## 15. Configuration Reference

### application.yml / application-local.yml

```yaml
averio:
  matching:
    auto-link-threshold: 0.95
    review-threshold: 0.75
    auto-reject-threshold: 0.40
    ai-enhancement-enabled: true
    ai-enhancement-range: [0.50, 0.90]
    blocking:
      index-on-startup: true
      rebuild-cron: "0 0 3 * * SUN"   # weekly full rebuild
    em:
      enabled: true
      sample-size: 5000
      max-iterations: 100
      schedule-cron: "0 0 2 * * *"    # nightly at 02:00
```

---

## 16. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/matching/score` | Score a pair of parties |
| `GET` | `/api/v1/matching/similar/{globalId}` | Find similar parties via blocking |
| `POST` | `/api/v1/matching/blocking/rebuild` | Trigger full index rebuild |
| `GET` | `/api/v1/matching/blocking/stats` | Blocking index statistics |
| `POST` | `/api/v1/matching/em/run/{partyType}` | Trigger EM parameter estimation |
| `GET` | `/api/v1/matching/em/parameters/{partyType}` | Get current m/u parameters |
| `GET` | `/api/v1/ml/soft-matches` | Get soft-match suggestions |
| `POST` | `/api/v1/ml/feedback` | Submit steward decision feedback |
| `GET` | `/api/v1/ml/model/{entityType}` | Get ML model info and metrics |

---

## 17. Extension Points

| Extension | How |
|-----------|-----|
| **Redis-backed blocking index** | Replace `ConcurrentHashMap` in `BlockingKeyService` with `RedisTemplate`; API unchanged |
| **Custom similarity function** | Add method to `SimilarityFunctions`; call from `ProbabilisticMatcher` |
| **New blocking strategy** | Add key generation in `BlockingKeyService.generateKeys()` |
| **Custom m/u priors** | Override constants in `ProbabilisticMatcher` or configure via `MatchingRule` weights |
| **Elasticsearch blocking** | Implement `findCandidates()` via ES multi-match query; return globalId set |
| **Gradient-boosted classifier** | Replace logistic regression in `MLMatchingService.retrainModel()` with XGBoost via REST API |
| **International name dictionaries** | Extend `NicknameService.GROUPS` with Spanish (Jose/Pepe), French (Guillaume/Guy), etc. |

---

*Generated by Averio Engineering. For questions, contact the MDM Platform team.*
