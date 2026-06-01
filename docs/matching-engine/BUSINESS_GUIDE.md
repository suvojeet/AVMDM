# Averio MDM — Matching Engine: Business & Vendor Guide

> **Audience:** Business users, vendor partners, data stewards, executives,
> and anyone who needs to understand how Averio MDM identifies and unifies
> party records — without needing to read code.  
> **Last updated:** 2026-05-18

---

## Table of Contents

1. [What Problem Does This Solve?](#1-what-problem-does-this-solve)
2. [What Is a Golden Record?](#2-what-is-a-golden-record)
3. [How the Matching Engine Works — Plain Language](#3-how-the-matching-engine-works--plain-language)
4. [The Five Stages Explained](#4-the-five-stages-explained)
5. [Confidence Score — What Does It Mean?](#5-confidence-score--what-does-it-mean)
6. [What Happens After a Match Is Found?](#6-what-happens-after-a-match-is-found)
7. [How the System Gets Smarter Over Time](#7-how-the-system-gets-smarter-over-time)
8. [Common Matching Scenarios](#8-common-matching-scenarios)
9. [Vendor Integration Guide](#9-vendor-integration-guide)
10. [Data Quality Requirements](#10-data-quality-requirements)
11. [Frequently Asked Questions (FAQ)](#11-frequently-asked-questions-faq)
12. [Glossary](#12-glossary)

---

## 1. What Problem Does This Solve?

Large enterprises maintain party data (customers, vendors, employees) across dozens of systems. The same real-world entity — say, "Robert Smith at IBM" — often appears as:

| System | Name | Company | Email |
|--------|------|---------|-------|
| CRM | Bob Smith | IBM Corp. | bob.smith@ibm.com |
| ERP | Robert Smith | International Business Machines | r.smith@ibm.com |
| Billing | R. Smith Jr. | IBM | (missing) |
| Support | Robert J. Smith | IBM Corporation | robert.smith@ibm.com |

Without a matching engine:
- **4 separate records** for the same person
- **Duplicate mailings**, incorrect reporting, broken customer-360 views
- **Regulatory risk** (GDPR, CCPA cannot be honoured across siloed systems)
- **Revenue leakage** from duplicate accounts, missed contract consolidation

With Averio MDM's matching engine:
- All 4 records are detected as the same entity
- A single **Golden Record** is created and kept up to date
- Every downstream system sees the same, correct, unified view

---

## 2. What Is a Golden Record?

A **Golden Record** is the single trusted version of a party across all source systems. Think of it as the "master copy."

```
   CRM record        ERP record       Billing record
   "Bob Smith"   +  "Robert Smith"  +  "R. Smith Jr."
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
                    GOLDEN RECORD
               ┌──────────────────────┐
               │  Name:  Robert Smith │  ← from ERP (most complete)
               │  Email: bob.smith@   │  ← from CRM (most recent)
               │  Phone: 212-555-1234 │  ← from Billing
               │  Org:   IBM          │  ← survivorship rules applied
               └──────────────────────┘
```

**Key characteristics of a golden record:**
- It is **automatically maintained** — when any source updates, the golden record updates
- It uses **survivorship rules** to pick the best value from competing sources
- It has a unique **Global ID** that links all source records together
- It is the **single source of truth** for all downstream systems

---

## 3. How the Matching Engine Works — Plain Language

Imagine you are a very thorough detective trying to figure out if two people in two different filing cabinets are the same person. You would:

1. **First, narrow your search** ("Is there anyone else with a similar-sounding last name, or the same birthday?") — this is **Blocking**

2. **Then check the evidence** — compare names, dates of birth, addresses, phone numbers — this is **Probabilistic Scoring**

3. **Look up whether a nickname is being used** ("Bob is a nickname for Robert; these are probably the same person") — this is **Nickname Intelligence**

4. **Ignore irrelevant labels** ("One file says 'Corp.', the other says 'Corporation' — these mean the same thing") — this is **Name Normalisation**

5. **Add up all the clues** and decide: Is this a match? Maybe? Definitely not? — this is the **Confidence Score**

6. **Check transitivity** ("If John = Bob, and Bob = Robert, then John = Robert too") — this is **Cluster Merging**

That is exactly what the Averio MDM Matching Engine does — automatically, for millions of records, in milliseconds.

---

## 4. The Five Stages Explained

### Stage 1 — Blocking (Finding Candidates)

**Without blocking**, the engine would have to compare every record against every other record. With 100 million records, that is 5,000,000,000,000,000 comparisons — impossible.

**With blocking**, the engine generates "fingerprints" (blocking keys) for each record and only compares records that share at least one fingerprint. This reduces comparisons by 99.99%.

**Example fingerprints for "Bob Smith, DOB 1985-03-15":**
- Phonetic code of "Smith" → finds "Smyth", "Smythe"
- Phonetic code of "Robert" (nickname of "Bob") → finds "Robert Smith"
- DOB year+month + initial → finds others with same birthday

---

### Stage 2 — Deterministic Matching (Perfect Evidence)

Before doing any complex analysis, the engine checks for **exact matches on high-confidence identifiers**:

| Identifier | Example | Why it is definitive |
|------------|---------|----------------------|
| Social Security Number (SSN) | 987-65-4321 | Unique by law (US) |
| Tax ID / EIN | 47-1234567 | Unique by law |
| Legal Entity Identifier (LEI) | 2138003QNYIBPZWKB419 | Global standard |
| DUNS Number | 012345678 | Industry-standard org ID |
| Email address | exact match | Unique to a person/company |

If any of these match exactly → **immediate 100% match**, no further analysis needed.

---

### Stage 3 — Probabilistic Scoring (Weighing the Evidence)

When there is no definitive identifier match, the engine weighs multiple pieces of evidence together using the **Fellegi-Sunter model** (the same statistical approach used by the US Census Bureau and leading data companies like Splink).

**The key insight:** Each piece of evidence has a different weight based on:
- How often that evidence matches between two truly identical records (**m probability**)
- How often that evidence accidentally matches between two different records (**u probability**)

**Example — Why Tax ID carries more weight than City:**

| Evidence | If they match, how often is it a true match? | How often do random records share this? |
|----------|----------------------------------------------|----------------------------------------|
| Tax ID | 99.9% of the time | Almost never (0.01%) |
| City | 85% of the time | Often (3% — large cities) |

The engine combines all available evidence using a mathematical formula (log-likelihood ratios) to produce a single **confidence score** from 0% to 100%.

---

### Stage 4 — AI Enhancement (Expert Opinion for Borderline Cases)

When the confidence score falls in the "grey zone" (50%–90%), the engine asks an AI assistant (GPT-4) to evaluate the pair and provide a second opinion. The final score is a weighted blend:
- 60% from the statistical model
- 40% from the AI assessment

This is particularly helpful for international names, unusual address formats, and edge cases that are hard to capture with rules.

---

### Stage 5 — Cluster Merging (Connecting the Dots)

Matching is done in pairs, but real-world data forms chains:
- **Record A** matches **Record B** (confidence: 97%)
- **Record B** matches **Record C** (confidence: 96%)
- Therefore: A, B, and C are all the same entity → **one golden record**

The engine uses a mathematical algorithm (Union-Find) to find all these chains automatically, ensuring that every related record ends up in the correct cluster.

---

## 5. Confidence Score — What Does It Mean?

The matching engine produces a **confidence score** from 0.00 to 1.00 (or 0% to 100%).

| Score Range | Label | Meaning | Action |
|-------------|-------|---------|--------|
| 0.95 – 1.00 | **High Confidence Match** | The engine is highly certain these are the same entity | Automatic merge |
| 0.75 – 0.94 | **Probable Match** | Strong evidence, but review recommended | Human review queue |
| 0.40 – 0.74 | **Possible Duplicate** | Some similarities, but insufficient evidence | Monitor / new record |
| 0.00 – 0.39 | **No Match** | Too different to be the same entity | No action |

### What contributes to a high score?

A score increases significantly when:
- Tax ID, SSN, or EIN match exactly
- Email address matches exactly
- Phone number matches
- Full name matches (including nicknames like Bob/Robert)
- Date of birth matches
- Address matches

A score decreases (or doesn't increase much) when:
- Only a postal code or city matches
- Only the email domain matches (everyone at IBM shares ibm.com)
- Party types differ (Individual vs. Organisation)

---

## 6. What Happens After a Match Is Found?

```
                    Match Found
                        │
           ┌────────────┼─────────────┐
           │            │             │
        AUTO_LINK  SEND TO STEWARD  CREATE_NEW
         (≥ 0.95)   (0.75–0.94)    (< 0.75)
           │            │             │
    Merge into    Human reviews    New golden
    golden record  the pair and    record created
    automatically  approves or
                   rejects merge
```

### When a Data Steward Reviews

Data stewards see:
- Both records side-by-side
- The confidence score and **exactly which attributes matched** (broken down by attribute)
- A recommendation (Suggest Merge / Review / Monitor)
- The ability to Approve or Reject the merge

Every steward decision is used to **improve the model** — the system learns from human judgement.

---

## 7. How the System Gets Smarter Over Time

### Self-Learning (No Labels Required)

Every night at 2:00 AM, the engine runs the **Expectation-Maximisation (EM) algorithm**. This automatically estimates, from your own data:
- How often should two records with the same last name actually be the same person?
- How often does a shared email domain indicate the same entity?

These estimates are called **m/u parameters** and they are automatically tuned to your industry, geography, and data quality without anyone writing rules.

### Learning from Steward Feedback

Every time a data steward approves or rejects a merge, the system:
1. Records the decision as training data
2. Once 5 or more new decisions have been made, automatically retrains the machine learning model
3. Future scoring is improved based on real human judgement from your domain

### The more you use it, the better it gets.

---

## 8. Common Matching Scenarios

### Scenario 1: Individual Customer, Same Person Different Systems

| | CRM | ERP |
|--|-----|-----|
| Name | Bob Smith | Robert Smith |
| DOB | 1985-03-15 | 1985-03-15 |
| Email | bob.smith@gmail.com | robert.smith@gmail.com |
| Phone | (212) 555-9876 | 212-555-9876 |
| Address | 123 Main St, NY 10001 | 123 Main Street, New York 10001 |

**Result:** Match — confidence ~0.93
- "Bob" is a recognised nickname for "Robert" (+)
- DOB matches exactly (very strong signal +)
- Phone last 7 digits match (+)
- Address matches after normalisation (Street=St, New York=NY) (+)
- Different emails, but phonetically similar (+)
→ **SEND_TO_STEWARD for review**

---

### Scenario 2: Organisation, Same Company Different Formats

| | System A | System B |
|--|----------|----------|
| Name | IBM Corp. | International Business Machines |
| Tax ID | 13-4567890 | 13-4567890 |
| Address | 1 New Orchard Rd, Armonk NY 10504 | One New Orchard Road, Armonk, NY |
| Phone | +1-914-499-1900 | 914.499.1900 |

**Result:** Match — confidence ~0.99
- Tax ID matches exactly (deterministic → immediate match)
→ **AUTO_LINK** (no human review needed)

---

### Scenario 3: Suspected Duplicate, Different Individuals

| | Record A | Record B |
|--|----------|----------|
| Name | John Smith | John Smith |
| DOB | 1985-03-15 | 1972-11-28 |
| Email | john.smith@gmail.com | john.smith@yahoo.com |
| Address | Chicago, IL 60601 | New York, NY 10001 |

**Result:** No match — confidence ~0.35
- Same name, but name "John Smith" is very common (low discriminating power)
- DOB differs by 13 years (strong negative signal)
- Different email domains, different cities
→ **No action — two separate golden records maintained**

---

### Scenario 4: Data Quality Issue (Typo in Name)

| | Old Record | New Record |
|--|------------|------------|
| Name | Elizbeth Johnson | Elizabeth Johnson |
| DOB | 1990-06-22 | 1990-06-22 |
| Email | e.johnson@acme.com | e.johnson@acme.com |
| Phone | 312-555-4321 | 312-555-4321 |

**Result:** Match — confidence ~0.98
- "Elizbeth" is detected as a transposition typo of "Elizabeth" (Damerau-Levenshtein)
- DOB exact match (strong signal)
- Email exact match
- Phone match
→ **AUTO_LINK** (typo corrected in golden record using survivorship rules)

---

## 9. Vendor Integration Guide

### How to Provide Party Data to Averio MDM

**Required fields:**

| Field | Individual | Organisation |
|-------|-----------|--------------|
| `sourceSystem` | Required | Required |
| `sourceSystemId` | Required | Required |
| `partyType` | Required (`INDIVIDUAL`) | Required (`ORGANIZATION`) |
| `firstName` + `lastName` | Required | — |
| `organizationName` | — | Required |
| `dateOfBirth` | Strongly recommended | — |
| `taxId` / `ein` | Recommended | Required |

**High-value optional fields** (significantly improve match quality):
- Email addresses
- Phone numbers
- Postal addresses
- SSN / National ID / Passport number
- DUNS / LEI numbers

**Date format:** ISO 8601 — `YYYY-MM-DD` (e.g. `1985-03-15`)

**Phone format:** Any standard format accepted — the engine normalises digits automatically.

**Name format:** Provide the full legal name. The engine handles salutations (Dr., Mr.), suffixes (Jr., Sr., III), and nicknames automatically.

---

### What to Expect in Return

For each submitted party, the API response includes:
- **`globalId`** — the unique golden record ID
- **`action`** — `AUTO_LINK`, `SEND_TO_STEWARD`, or `CREATE_NEW`
- **`bestMatchScore`** — the confidence score (0.00–1.00)
- **`candidates`** — list of potential matches with per-attribute score breakdown

---

### API Quick Start

```bash
# Submit a new party for matching
POST /api/v1/parties
Content-Type: application/json

{
  "partyType": "INDIVIDUAL",
  "sourceSystem": "MY_CRM",
  "sourceSystemId": "CRM-12345",
  "firstName": "Bob",
  "lastName": "Smith",
  "dateOfBirth": "1985-03-15",
  "emails": { "primary": "bob.smith@gmail.com" },
  "phones": { "mobile": "2125559876" }
}
```

---

## 10. Data Quality Requirements

The matching engine performs best when data quality is high. Here are the most impactful quality improvements:

| Data Quality Issue | Impact on Matching | Recommendation |
|--------------------|--------------------|----------------|
| **Missing DOB** for individuals | Medium — reduces discrimination power | Capture DOB at point of entry |
| **Missing Tax ID** for organisations | High — loss of best identifier | Mandatory for B2B vendors |
| **Unformatted phone numbers** | Low — engine normalises | Acceptable |
| **Abbreviated names** ("IBM" for "International Business Machines") | Low — engine handles abbreviations | Acceptable |
| **Nickname names** ("Bob" vs "Robert") | Low — engine has nickname dict | Acceptable |
| **Missing address** | Medium — reduces blocking recall slightly | Provide when available |
| **Wrong party type** (INDIVIDUAL vs ORGANIZATION) | High — records won't cross-type match | Validate at source |
| **Duplicate records within same source** | High — creates false positives | Deduplicate at source before ingestion |

---

## 11. Frequently Asked Questions (FAQ)

> These questions and answers are also used by the Averio AI Assistant to answer natural language queries.

---

**Q: How does the matching engine know that "Bob" and "Robert" are the same person?**

A: The engine includes a built-in Nickname Dictionary with over 90 English name equivalence groups. "Bob", "Bobby", "Rob", and "Robbie" are all registered as equivalents of "Robert". When the engine compares a record with first name "Bob" against one with first name "Robert", the nickname service returns a similarity of 0.90, which is counted as near-certain agreement on the first name attribute.

---

**Q: How does the engine handle "IBM Corp." vs "IBM Corporation"?**

A: The engine runs all organisation names through the Name Normaliser service, which strips legal entity suffixes (Corp, Corporation, Inc, Incorporated, LLC, Ltd, Limited, and 20+ others) before comparing. Both "IBM Corp." and "IBM Corporation" become "ibm" after normalisation, so they compare as identical.

---

**Q: What confidence score is needed for an automatic merge?**

A: By default, a score of 0.95 (95%) or above triggers an automatic merge without human review. This threshold can be configured per matching rule. Scores between 0.75 and 0.94 go to the data steward queue.

---

**Q: Can the engine match across party types (e.g., an Individual and an Organisation)?**

A: No. Matching only occurs between records of the same party type. An INDIVIDUAL record will never be matched against an ORGANIZATION record, as they represent fundamentally different entities.

---

**Q: How many records can the engine process?**

A: The blocking architecture scales to trillion-scale records. The engine uses a multi-strategy inverted index to reduce the candidate pool from O(N²) to O(N × k) where k is typically 10–100. At 1 billion records, each new record requires comparing against approximately 50–200 candidates, not 1 billion. Response time is typically under 100 milliseconds per record.

---

**Q: How does the engine handle typos in names?**

A: The engine uses the Damerau-Levenshtein algorithm, which specifically handles transpositions (e.g., "Elizbeth" → "Elizabeth", "Jonh" → "John"). A transposition is counted as one error rather than two, making it much more resilient to common data entry mistakes.

---

**Q: Will two records with the same email address always be merged?**

A: Not automatically — but it is a strong signal. An exact email match has an m-probability of 0.92 and a u-probability of 0.002, meaning that when two records share an email, there is roughly a 460× likelihood ratio favouring a match. Combined with other evidence, this typically results in an AUTO_LINK decision. On its own, an email match alone would result in a SEND_TO_STEWARD score.

---

**Q: What happens if the same Tax ID appears on two different companies?**

A: A Tax ID exact match is treated as a deterministic match (confidence = 1.00, AUTO_LINK). If this produces incorrect merges, it indicates a data quality problem at the source — the Tax ID may be incorrectly recorded. The steward can reject the merge, which will be captured as feedback.

---

**Q: How does the system learn from steward decisions?**

A: Every time a data steward approves or rejects a merge, the system captures the 11-dimensional feature vector of that pair along with the decision (MATCH or NO_MATCH) as training data. Once 5 or more new decisions have been captured, the logistic regression model automatically retrains. Over time, the model adapts to your specific data characteristics.

---

**Q: Does the engine score every field or only the fields I provide?**

A: The engine only scores attributes that are present in both records. Missing data is not penalised — it simply does not contribute to the score. A pair with only name and DOB shared will be scored only on those attributes. Providing more data fields generally increases both accuracy and confidence.

---

**Q: What is a "blocking key"?**

A: A blocking key is a simplified fingerprint derived from a party record, used to group similar records together. For example, the Double Metaphone encoding of "Smith" is "SM0" — this becomes the blocking key that groups "Smith", "Smyth", "Smythe", and "Schmidt" into the same bucket. The engine generates up to 9 different types of blocking keys per record to ensure that true matches always end up in at least one shared bucket.

---

**Q: Can I configure which fields are most important for my use case?**

A: Yes. Matching Rules allow you to specify custom attribute weights. For example, a financial institution might assign double weight to Tax ID and SSN, while a retail company might weight email and phone more heavily. Custom rules can be applied per party type, per source system, or globally.

---

**Q: What is a data steward?**

A: A data steward is the human expert who reviews potential matches that the engine is not confident enough to automatically merge. They see both records side-by-side, the confidence score, and the per-attribute breakdown, then decide whether to approve the merge or keep the records separate. Their decisions are fed back to improve the engine.

---

**Q: How does the "transitive closure" work?**

A: If Record A matches Record B, and Record B matches Record C, the engine automatically concludes that A, B, and C are all the same entity. This is called transitive closure. The engine uses an efficient algorithm called Union-Find to compute these chains across all records simultaneously.

---

**Q: How does the self-learning EM algorithm work without labelled data?**

A: The EM (Expectation-Maximisation) algorithm exploits a key insight: when you randomly sample pairs of records, the vast majority (>99.9%) are non-matches. The algorithm initialises with domain priors, then iteratively estimates what probability of agreement would be expected if the pairs were split into "matches" and "non-matches". After typically 20–40 iterations, the algorithm converges on accurate estimates of match and non-match probabilities for each attribute — derived entirely from your actual data, with no human labels required.

---

**Q: Is the matching engine compliant with privacy regulations?**

A: The engine processes personal data in-memory during matching and does not create additional copies. SSNs and other sensitive identifiers are stored encrypted. The engine itself is a processing mechanism — GDPR/CCPA compliance depends on your data governance policies governing the underlying party records.

---

## 12. Glossary

| Term | Definition |
|------|-----------|
| **Blocking** | The process of grouping records into candidate buckets based on shared fingerprints (blocking keys), to avoid comparing every record against every other record |
| **Blocking Key** | A simplified fingerprint (e.g., phonetic code of a name, first 4 digits of a Tax ID) used to find candidate matches without full comparison |
| **Candidate Pool** | The set of golden records retrieved from the blocking index for comparison against an incoming record |
| **Confidence Score** | A number from 0.00 to 1.00 representing how certain the engine is that two records represent the same entity |
| **Data Steward** | A human expert who reviews borderline match decisions and approves or rejects merges |
| **Damerau-Levenshtein** | A string similarity algorithm that counts transpositions (e.g., "Jonh" → "John") as single edits |
| **Deterministic Match** | A match based on exact agreement on a high-confidence identifier (SSN, Tax ID, etc.); confidence = 1.00 |
| **Double Metaphone** | A phonetic encoding algorithm that maps names with similar pronunciation to the same code (e.g., "Smith" and "Smythe" both encode to "SM0") |
| **EM Algorithm** | Expectation-Maximisation — an unsupervised statistical algorithm that learns matching parameters from data without requiring labelled examples |
| **Fellegi-Sunter Model** | The theoretical foundation of the engine; uses log-likelihood ratios to combine evidence from multiple attributes into a single match probability |
| **Feature Vector** | A set of 30 numerical measurements describing the similarity between two party records |
| **Golden Record** | The single trusted, merged view of a party across all source systems |
| **Global ID** | A unique identifier assigned to each golden record; links all source records representing the same entity |
| **Jaro-Winkler** | A string similarity metric that gives higher weight to common prefixes; values range from 0 (completely different) to 1 (identical) |
| **m-probability** | P(attribute agrees \| true match) — how often two truly identical records agree on this attribute |
| **Monge-Elkan** | A token-level similarity algorithm that aligns individual words between two strings; good for names with different numbers of tokens |
| **Nickname Dictionary** | A built-in database of 90+ English name equivalence groups (e.g., Bob/Robert, Liz/Elizabeth) |
| **Probabilistic Match** | A match based on the statistical weight of multiple attributes; produces a confidence score |
| **Survivorship Rules** | Rules that determine which source record's value "wins" when creating a golden record (e.g., "most recent", "most complete", "most trusted source") |
| **TF-IDF Cosine** | A text similarity measure based on character n-gram frequencies; better than simple Jaccard for long organisation names |
| **Token Set Ratio** | A string similarity measure that compares sets of words rather than full strings; handles abbreviations and word-order differences |
| **Transitive Closure** | If A=B and B=C, then A=C — the engine uses Union-Find to compute this for all matching records |
| **u-probability** | P(attribute agrees \| non-match) — how often two different records accidentally agree on this attribute |
| **Union-Find (DSU)** | A data structure for computing connected components (clusters) efficiently; used for transitive closure in clustering |

---

*For technical questions, see [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md).  
For AI assistant queries, see [AI_KNOWLEDGE_BASE.md](AI_KNOWLEDGE_BASE.md).*
