# Patent Maintenance Agent — Averio MDM

**Agent Identity: Averio-Skills / Patent Maintenance Mode**

---

## Patent Document Paths

| File | Path |
|---|---|
| Source (Markdown) | `docs/patent/USPTO_PATENT_APPLICATION.md` |
| Export (DOCX) | `docs/patent/USPTO_PATENT_APPLICATION.docx` |
| Export (PDF) | `docs/patent/USPTO_PATENT_APPLICATION.pdf` |
| DOCX Builder | `docs/patent/build_docx_with_figures.py` |
| Figures Generator | `docs/patent/generate_figures.py` |

## Export Rule

**Whenever `USPTO_PATENT_APPLICATION.md` is modified, immediately run:**

```powershell
# Step 1 — Rebuild DOCX with figures
cd "C:\Users\Rakhi Chatterjee\Documents\averio-mdm\docs\patent"
python build_docx_with_figures.py

# Step 2 — Convert DOCX → PDF (overwrites existing PDF)
python convert_to_pdf.py
```

Both files must be regenerated after every `.md` update. Never deliver a patent update without regenerating both exports.

---

## Patent Knowledge Model

### Invention Summary

**Core Invention:** An adaptive, self-calibrating enterprise Master Data Management (MDM) platform for large-scale entity resolution combining nine-strategy union blocking, unsupervised Fellegi-Sunter EM parameter estimation, three-stage cascading match pipeline (deterministic → probabilistic → AI/LLM), provisional golden identity assignment, and post-update probabilistic cluster drift detection.

**Problems Solved:**
1. O(N²) blocking complexity → reduced to O(N×k) via nine-strategy union
2. Static match model degradation → self-calibrating EM algorithm (no labeled data required)
3. Null golden identity state → provisional golden ID assigned at first commit
4. Post-assignment cluster drift → automatic probabilistic re-evaluation on every update
5. Single-mode matching limitations → three-stage cascade with LLM fallback for ambiguous range only
6. Transitive clustering gaps → Union-Find with path compression
7. Static golden record computation → query-time survivorship assembly, instantly rule-configurable
8. ML retraining requires current record state → feature vectors captured at decision time

**Technical Benefits:**
- Zero null-state periods for any party record at any lifecycle stage
- Fully unsupervised parameter learning — no labeled training sets required
- Immediate effect of survivorship rule changes without data layer re-computation
- Complete immutable audit trail of cluster membership changes
- Per-view golden records for multi-stakeholder environments (risk, finance, compliance, HR, legal)
- Built-in test laboratory operating against live infrastructure

---

### Patent Coverage Map

#### Independent Claims (5)

| Claim | Subject | Core Innovation |
|---|---|---|
| Claim 1 | Nine-strategy union blocking + EM-calibrated Fellegi-Sunter + provisional golden ID | Combines blocking, self-calibrating scoring, and null-state elimination in a single method |
| Claim 2 | Post-update cluster drift detection | Novel — no prior art discloses this |
| Claim 3 | Self-calibrating EM parameter estimation system | System claim covering the EM apparatus |
| Claim 4 | Human-in-the-loop ML retraining pipeline | Feature capture at decision time (not training time) |
| Claim 5 | Provisional golden identity lifecycle | Provisional → permanent promotion without additional operations |

#### Dependent Claims (10)

| Claim | Depends On | Narrows To |
|---|---|---|
| Claim 6 | Claim 1 | AI/LLM third stage — conditional invocation, blended score |
| Claim 7 | Claim 1 | Nickname equivalence group expansion |
| Claim 8 | Claim 1 | Dual concurrent hash map (inverted + forward index) |
| Claim 9 | Claim 2 | Timeline event document schema |
| Claim 10 | Claim 3 | EM algorithm log-space numerical stability |
| Claim 11 | Claim 3 | Query-time survivorship rule engine (six rule types) |
| Claim 12 | Claim 4 | Feature capture at decision time vs. training time |
| Claim 13 | Claim 5 | Provisional ID format + client-supplied ID migration |
| Claim 14 | (Independent) | Transitive cluster formation via Union-Find |
| Claim 15 | Claim 1 | 20+ similarity algorithms with Fellegi-Sunter weighting |

#### Embodiment Coverage

| Feature | Embodiment Section | Claim Coverage |
|---|---|---|
| Nine-strategy blocking | §II | Claims 1, 7, 8, 15 |
| EM parameter estimation | §III | Claims 1, 3, 10 |
| Three-stage cascading pipeline | §IV | Claims 1, 6, 15 |
| Provisional golden identity | §V | Claims 1, 5, 13 |
| Cluster drift detection | §VI | Claim 2, 9 |
| Transitive Union-Find merging | §VII | Claim 14 |
| Query-time survivorship | §VIII | Claim 11 |
| Human-in-loop ML retraining | §IX | Claims 4, 12 |
| Name normalization | §X | Supporting Claim 7, 15 |
| In-app test laboratory | §XI | Not claimed — operational disclosure only |
| View-scoped golden records | §VIII.C | Claim 11 partial |
| Name uppercase normalization | SurvivorshipEngine | **NOT YET COVERED — see Innovation Inventory** |
| Session-persistent search state | GoldenView frontend | **NOT YET COVERED** |
| Golden Record Explorer UI | GoldenView frontend | **NOT YET COVERED** |

---

### Innovation Inventory

| # | Innovation | Patent Status | Claim(s) |
|---|---|---|---|
| 1 | Nine-strategy union blocking engine | ✅ Fully Covered | 1, 7, 8, 15 |
| 2 | Self-calibrating EM Fellegi-Sunter estimation | ✅ Fully Covered | 1, 3, 10 |
| 3 | Three-stage cascading match pipeline | ✅ Fully Covered | 1, 6, 15 |
| 4 | Provisional golden identity (null-state elimination) | ✅ Fully Covered | 1, 5, 13 |
| 5 | Post-update cluster drift detection | ✅ Fully Covered | 2, 9 |
| 6 | Human-in-loop ML retraining (decision-time capture) | ✅ Fully Covered | 4, 12 |
| 7 | Query-time survivorship rule engine | ✅ Fully Covered | 11 |
| 8 | View-scoped golden records | ⚠️ Partially Covered | Claim 11 (extend) |
| 9 | Transitive Union-Find clustering | ✅ Covered | 14 |
| 10 | Name normalization (org suffix stripping) | ⚠️ Partially Covered | Supporting §X, unclaimed |
| 11 | Nickname equivalence (90+ groups) | ✅ Covered | 7 |
| 12 | 20+ similarity algorithms | ✅ Covered | 15 |
| 13 | In-application test laboratory | ⚠️ Disclosed, Unclaimed | §XI |
| 14 | **Name uppercase normalization in golden record** | ❌ Not Covered | — |
| 15 | **Session-persistent Golden Record Explorer** | ❌ Not Covered | — |
| 16 | **Search-by-name typeahead with golden ID resolution** | ❌ Not Covered | — |
| 17 | **Attribute filter panel (user-controlled visibility)** | ❌ Not Covered | — |
| 18 | **Multi-panel golden record explorer UI** | ❌ Not Covered | — |
| 19 | **Enterprise view selector in golden record query** | ❌ Not Covered | — |
| 20 | **Client-supplied golden ID migration bypass** | ✅ Covered | Claim 13, §V.C |

---

## Enhancement Processing Rules

### When a software enhancement is submitted:

**Step 1 — Classify the enhancement:**
- Parse what was changed in the codebase
- Map to Innovation Inventory above
- Classify: Already Covered / Partially Covered / Not Covered / Potentially Patentable

**Step 2 — Apply Patent Update Rules:**

| Classification | Action |
|---|---|
| Already Covered | Confirm coverage, optionally broaden claim language |
| Partially Covered | Add embodiment text, consider new dependent claim |
| Not Covered | Generate new embodiment + new claim language |
| Highly Innovative | Recommend Continuation / Divisional / Separate filing |

**Step 3 — Update `.md` file**

**Step 4 — Regenerate PDF** (run export pipeline below)

---

## PDF Export Pipeline

After every `.md` update, run this script:

```powershell
cd "C:\Users\Rakhi Chatterjee\Documents\averio-mdm\docs\patent"
python build_docx_with_figures.py
python convert_to_pdf.py
```

`convert_to_pdf.py` is the PDF conversion script at `docs/patent/convert_to_pdf.py`.

---

## Change Log

| Date | Enhancement | Sections Modified | Claims Modified | Claims Added | Status |
|---|---|---|---|---|---|
| 2026-06-10 | Initial patent ingestion and Knowledge Model creation | — | — | — | ✅ Complete |

---

## Portfolio Recommendations (Current)

1. **Continuation Application** — When the Golden Record Explorer UI innovations (session persistence, typeahead search, attribute filter panel, multi-panel view) are sufficiently developed, file a continuation covering the UI/UX layer as a separate application referencing AVERIO-001-US.

2. **Divisional Consideration** — The Human-in-the-Loop ML pipeline (Claims 4, 12) could be pursued as a divisional targeting the broader ML feedback loop space independent of MDM context.

3. **PCT International Filing** — File PCT application for jurisdictions where Averio MDM will be commercialized (EU, UK, Canada, Australia, Singapore, Japan).

4. **Trade Secret Protection** — The specific nickname equivalence group data (90+ groups) and the EM prior initialization values are better protected as trade secrets than as patent disclosures since disclosure enables exact replication.
