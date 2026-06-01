"""
Standalone match diagnostic — no Neo4j / Java required.
Mirrors the exact logic of BlockingKeyService + ProbabilisticMatcher.

Edit the two PARTY dicts at the bottom with the real values you see in
the UI for source IDs 02121414 and NT023512, then re-run.
"""

import math
import jellyfish
from difflib import SequenceMatcher

# ── Double Metaphone (mirrors Apache Commons DoubleMetaphone) ─────────────────
def dm(token: str) -> str:
    if not token:
        return ""
    try:
        code = jellyfish.metaphone(token.strip())
        return code or ""
    except Exception:
        return ""

# ── String similarity helpers ─────────────────────────────────────────────────
def jaro_winkler(a, b):
    if not a or not b: return 0.0
    return jellyfish.jaro_winkler_similarity(a.lower(), b.lower())

def token_sort_ratio(a, b):
    if not a or not b: return 0.0
    ta = " ".join(sorted(a.lower().split()))
    tb = " ".join(sorted(b.lower().split()))
    return SequenceMatcher(None, ta, tb).ratio()

def token_set_ratio(a, b):
    if not a or not b: return 0.0
    sa, sb = set(a.lower().split()), set(b.lower().split())
    inter = sa & sb
    if not inter: return 0.0
    sorted_inter = " ".join(sorted(inter))
    r1 = SequenceMatcher(None, sorted_inter, " ".join(sorted(sa - inter))).ratio()
    r2 = SequenceMatcher(None, sorted_inter, " ".join(sorted(sb - inter))).ratio()
    return max(SequenceMatcher(None, " ".join(sorted(sa)), " ".join(sorted(sb))).ratio(),
               r1, r2)

def bigram_jaccard(a, b):
    if not a or not b: return 0.0
    def bigrams(s): return set(s[i:i+2] for i in range(len(s)-1))
    bg_a, bg_b = bigrams(a.lower()), bigrams(b.lower())
    if not bg_a or not bg_b: return 0.0
    return len(bg_a & bg_b) / len(bg_a | bg_b)

def levenshtein_sim(a, b):
    if not a or not b: return 0.0
    d = jellyfish.levenshtein_distance(a.lower(), b.lower())
    return 1.0 - d / max(len(a), len(b))

# ── Blocking key generation (mirrors BlockingKeyService.generateKeys) ─────────
def generate_keys(p: dict) -> set:
    keys = set()
    raw = (p.get("organizationName") or p.get("fullName") or
           ((p.get("firstName","") + " " + p.get("lastName","")).strip()))
    name = raw.lower().strip() if raw else None

    # Strategy 1 — Double Metaphone per token
    if name:
        for tok in name.split():
            if len(tok) >= 2:
                code = dm(tok)
                if code: keys.add(f"DM:{code}")

    # Strategy 2 — Full collapsed name DM
    if name:
        code = dm(name.replace(" ", ""))
        if code: keys.add(f"DMF:{code}")

    # Strategy 3 — First initial + last token phonetic
    if name:
        tokens = name.split()
        if tokens:
            last_code = dm(tokens[-1])
            if last_code:
                keys.add(f"FI:{tokens[0][0]}:{last_code}")

    # Strategy 4 — DOB year+month + name initial
    dob = p.get("dateOfBirth")
    if dob and name:
        parts = str(dob).split("-")
        if len(parts) >= 2:
            keys.add(f"DOB:{parts[0]}-{parts[1]}:{name[0]}")

    # Strategy 5 — Tax ID first 4 digits
    tax = p.get("taxId") or p.get("ein") or ""
    digits = "".join(c for c in tax if c.isdigit())
    if len(digits) >= 4:
        keys.add(f"TAX:{digits[:4]}")

    # Strategy 6 — Phone last 7 digits
    for phone in (p.get("phones") or {}).values():
        if phone:
            d = "".join(c for c in phone if c.isdigit())
            if len(d) >= 7: keys.add(f"PH7:{d[-7:]}")

    # Strategy 7 — Email domain + name initial
    for email in (p.get("emails") or {}).values():
        if email and "@" in email and name:
            domain = email.split("@")[1].lower()
            keys.add(f"EM:{domain}:{name[0]}")

    # Strategy 8 — Postal code prefix + name phonetic
    postal = p.get("postalCode","")
    if postal and name:
        pfx = postal.replace("-","")[:5].lower()
        tokens = name.split()
        if tokens:
            code = dm(tokens[0])
            if code: keys.add(f"ZIP:{pfx}:{code}")

    # Strategy 9 — Exact high-cardinality identifiers
    if p.get("dunsNumber"):
        keys.add("DUNS:" + "".join(c for c in p["dunsNumber"] if c.isdigit()))
    if p.get("lei"):
        keys.add("LEI:" + p["lei"].upper())
    if p.get("nationalId"):
        keys.add("NID:" + "".join(c for c in p["nationalId"] if c.isalnum()).upper())

    return keys

# ── Fellegi-Sunter priors {m, u} ──────────────────────────────────────────────
FS = {
    "firstName":     (0.920, 0.012),
    "lastName":      (0.950, 0.006),
    "fnPhonetic":    (0.900, 0.025),
    "lnPhonetic":    (0.920, 0.018),
    "nameTokenSort": (0.880, 0.008),
    "nameTokenSet":  (0.860, 0.010),
    "nameBigram":    (0.850, 0.012),
    "dobExact":      (0.980, 0.003),
    "postalExact":   (0.870, 0.028),
    "city":          (0.850, 0.030),
    "taxId":         (0.999, 0.0001),
    "emailExact":    (0.920, 0.002),
    "phoneExact":    (0.880, 0.003),
    "ssn":           (0.999, 0.00001),
}

def fs_weight(agreement, m, u):
    agree_w    = math.log(m / u)
    disagree_w = math.log((1 - m) / (1 - u))
    raw  = agreement * agree_w + (1 - agreement) * disagree_w
    maxW = agree_w
    minW = disagree_w
    return raw, maxW, minW

def score_parties(a: dict, b: dict):
    breakdown = {}
    contribs  = []

    def add(name, agreement, fs_key, weight=1.0):
        m, u = FS[fs_key]
        r, mx, mn = fs_weight(agreement, m, u)
        contribs.append((r * weight, mx * weight, mn * weight))
        rng = (mx - mn) * weight
        breakdown[name] = round(max(0, min(1, ((r * weight) - mn * weight) / rng)) * 100, 1) if rng > 0 else 50.0

    fn_a = (a.get("firstName") or "").lower()
    fn_b = (b.get("firstName") or "").lower()
    ln_a = (a.get("lastName")  or "").lower()
    ln_b = (b.get("lastName")  or "").lower()

    # First name
    if fn_a and fn_b:
        add("firstName",   jaro_winkler(fn_a, fn_b), "firstName")
        add("fnPhonetic",  1.0 if dm(fn_a) == dm(fn_b) else 0.0, "fnPhonetic", 0.7)

    # Last name
    if ln_a and ln_b:
        add("lastName",    jaro_winkler(ln_a, ln_b), "lastName")
        add("lnPhonetic",  1.0 if dm(ln_a) == dm(ln_b) else 0.0, "lnPhonetic", 0.7)

    # Full name multi-algo
    full_a = (a.get("fullName") or f"{fn_a} {ln_a}").strip()
    full_b = (b.get("fullName") or f"{fn_b} {ln_b}").strip()
    if full_a and full_b:
        add("nameTokenSort", token_sort_ratio(full_a, full_b), "nameTokenSort")
        add("nameTokenSet",  token_set_ratio(full_a,  full_b), "nameTokenSet", 0.8)
        add("nameBigram",    bigram_jaccard(full_a,   full_b), "nameBigram",   0.7)

    # DOB
    dob_a, dob_b = a.get("dateOfBirth"), b.get("dateOfBirth")
    if dob_a and dob_b:
        add("dobExact", 1.0 if str(dob_a) == str(dob_b) else 0.0, "dobExact")

    # Tax ID (deterministic-weight)
    tax_a = a.get("taxId",""); tax_b = b.get("taxId","")
    if tax_a and tax_b:
        norm_a = "".join(c for c in tax_a if c.isalnum()).upper()
        norm_b = "".join(c for c in tax_b if c.isalnum()).upper()
        add("taxId", 1.0 if norm_a == norm_b else 0.0, "taxId")

    # Email
    em_a = list((a.get("emails") or {}).values())
    em_b = list((b.get("emails") or {}).values())
    if em_a and em_b:
        add("emailExact", 1.0 if em_a[0].lower() == em_b[0].lower() else 0.0, "emailExact")

    # Phone
    ph_a = list((a.get("phones") or {}).values())
    ph_b = list((b.get("phones") or {}).values())
    if ph_a and ph_b:
        d_a = "".join(c for c in ph_a[0] if c.isdigit())
        d_b = "".join(c for c in ph_b[0] if c.isdigit())
        add("phoneExact", 1.0 if d_a == d_b else 0.0, "phoneExact")

    # Postal
    pc_a, pc_b = a.get("postalCode",""), b.get("postalCode","")
    if pc_a and pc_b:
        add("postalExact", 1.0 if pc_a.replace("-","") == pc_b.replace("-","") else 0.0, "postalExact")

    if not contribs:
        return 0.0, breakdown

    raw_total = sum(c[0] for c in contribs)
    max_total = sum(c[1] for c in contribs)
    min_total = sum(c[2] for c in contribs)
    rng = max_total - min_total
    final = max(0.0, min(1.0, (raw_total - min_total) / rng)) if rng > 0 else 0.5
    return final, breakdown

# ── Deterministic check ───────────────────────────────────────────────────────
def deterministic_check(a, b):
    def norm(v): return "".join(c for c in (v or "").upper() if c.isalnum())
    for field in ["ssn","taxId","ein","dunsNumber","lei","nationalId","passport"]:
        va, vb = norm(a.get(field,"")), norm(b.get(field,""))
        if va and vb and va == vb:
            return True, field.upper()
    if (norm(a.get("sourceSystem","")) == norm(b.get("sourceSystem","")) and
        norm(a.get("sourceSystemId","")) == norm(b.get("sourceSystemId",""))):
        return True, "SOURCE_SYSTEM_ID"
    return False, None

# ── Main diagnosis ────────────────────────────────────────────────────────────
def diagnose(p1: dict, p2: dict):
    SEP = "=" * 70

    print(f"\n{SEP}")
    print("  AVERIO MDM — MATCH DIAGNOSTIC")
    print(SEP)
    print(f"\n  Party A  |  sourceId: {p1.get('sourceSystemId')}  |  source: {p1.get('sourceSystem')}")
    print(f"  Party B  |  sourceId: {p2.get('sourceSystemId')}  |  source: {p2.get('sourceSystem')}")

    # ── 1. Blocking keys ──────────────────────────────────────────────────────
    keys1 = generate_keys(p1)
    keys2 = generate_keys(p2)
    shared = keys1 & keys2

    print(f"\n{'─'*70}")
    print("  STEP 1 — BLOCKING KEY ANALYSIS")
    print(f"{'─'*70}")
    print(f"  Party A keys ({len(keys1)}): {sorted(keys1)}")
    print(f"  Party B keys ({len(keys2)}): {sorted(keys2)}")
    print(f"  Shared keys ({len(shared)}): {sorted(shared)}")

    if not shared:
        print(f"\n  ❌ ROOT CAUSE: BLOCKING MISS")
        print(f"     These two records share ZERO blocking keys.")
        print(f"     The matching engine NEVER put them in the same candidate pool.")
        print(f"     They were NEVER scored against each other.\n")
        print("  WHY:")
        print("     Blocking uses: name phonetics, DOB, phone last-7, email domain,")
        print("     postal code, tax-ID prefix, DUNS, LEI, NationalId.")
        print("     sourceSystemId is NOT a blocking key.")
        print("\n  FIX OPTIONS:")
        print("     1. Manually merge via Steward Console → Actions → Merge")
        print("     2. POST http://localhost:8080/api/v1/parties/merge")
        print("     3. Correct the source data so both records share a common")
        print("        attribute, then re-ingest the newer record.")
        print(f"\n{SEP}\n")
        return

    # ── 2. Deterministic check ────────────────────────────────────────────────
    print(f"\n{'─'*70}")
    print("  STEP 2 — DETERMINISTIC CHECK (exact identifier match)")
    print(f"{'─'*70}")
    det_match, det_field = deterministic_check(p1, p2)
    if det_match:
        print(f"  ✅ DEFINITE MATCH on {det_field} — would AUTO_LINK immediately")
        print(f"\n  ROOT CAUSE: STALE STATE")
        print(f"     The records now produce a definite match but were ingested")
        print(f"     before each other existed, or the blocking index was empty.")
        print(f"     Fix: manually merge or rebuild blocking index and re-ingest.")
        print(f"\n{SEP}\n")
        return
    print("  No exact identifier match — proceeding to probabilistic scoring.")

    # ── 3. Probabilistic score ────────────────────────────────────────────────
    print(f"\n{'─'*70}")
    print("  STEP 3 — FELLEGI-SUNTER PROBABILISTIC SCORE")
    print(f"{'─'*70}")
    final_score, breakdown = score_parties(p1, p2)
    for attr, pct in sorted(breakdown.items(), key=lambda x: -x[1]):
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"  {attr:<18} {bar}  {pct:5.1f}%")

    print(f"\n  FINAL SCORE:  {final_score*100:.1f}%")

    # ── 4. Threshold routing ──────────────────────────────────────────────────
    AUTO_LINK = 0.95
    REVIEW    = 0.75
    REJECT    = 0.40

    print(f"\n{'─'*70}")
    print("  STEP 4 — THRESHOLD ROUTING")
    print(f"{'─'*70}")
    print(f"  AUTO_LINK   ≥ {AUTO_LINK*100:.0f}%   →  same golden ID immediately")
    print(f"  STEWARD     ≥ {REVIEW*100:.0f}%   →  provisional golden + human review task")
    print(f"  CREATE_NEW  ≥ {REJECT*100:.0f}%   →  separate golden IDs")
    print(f"  AUTO_REJECT  < {REJECT*100:.0f}%   →  ignored entirely")
    print()

    if final_score >= AUTO_LINK:
        action = "AUTO_LINK"
        cause  = "STALE_STATE — score meets AUTO_LINK but records already exist separately."
    elif final_score >= REVIEW:
        action = "SEND_TO_STEWARD"
        cause  = ("BELOW_AUTO_LINK_THRESHOLD — score is in the steward review zone. "
                  "Each record got a provisional golden ID. Check the Steward Console "
                  "for an open MATCH_REVIEW task.")
    elif final_score >= REJECT:
        action = "CREATE_NEW"
        cause  = ("SCORE_BELOW_REVIEW_THRESHOLD — the score does not meet the "
                  f"{REVIEW*100:.0f}% minimum for steward review. "
                  "The engine created separate golden IDs.")
    else:
        action = "AUTO_REJECT"
        cause  = "SCORE_TOO_LOW — candidate filtered out before scoring."

    print(f"  ➜  ACTION: {action}")
    print(f"\n{'─'*70}")
    print("  ROOT CAUSE")
    print(f"{'─'*70}")
    print(f"  {cause}")

    # Low-scoring attributes
    low = {k: v for k, v in breakdown.items() if v < 60}
    if low:
        print(f"\n  LOW-SCORING ATTRIBUTES (dragging score down):")
        for attr, pct in sorted(low.items(), key=lambda x: x[1]):
            print(f"    • {attr}: {pct:.1f}%")

    print(f"\n  FIX:")
    if action == "SEND_TO_STEWARD":
        print("    Check Steward Console → open MATCH_REVIEW tasks for these parties.")
        print("    Approve the task to merge them into one golden ID.")
    else:
        print("    1. Correct the differing attributes in the source system.")
        print("    2. Re-ingest the newer record — it will then AUTO_LINK.")
        print("    OR manually merge via: POST http://localhost:8080/api/v1/parties/merge")
    print(f"\n{SEP}\n")


# ═══════════════════════════════════════════════════════════════════════════════
#  ▼▼▼  EDIT THESE WITH THE ACTUAL VALUES FROM THE UI  ▼▼▼
# ═══════════════════════════════════════════════════════════════════════════════

PARTY_02121414 = {
    "sourceSystem":   "UNKNOWN",
    "sourceSystemId": "02121414",
    "partyType":      "INDIVIDUAL",
    "firstName":      "John",
    "lastName":       "Smith",
    "fullName":       "John Smith",
    "dateOfBirth":    "",
    "taxId":          "",
    "ssn":            "",
    "emails":         {},
    "phones":         {},
    "postalCode":     "",
    "dunsNumber":     "",
    "lei":            "",
    "nationalId":     "",
}

PARTY_NT023512 = {
    "sourceSystem":   "UNKNOWN",
    "sourceSystemId": "NT023512",
    "partyType":      "INDIVIDUAL",
    "firstName":      "Jonathan",
    "lastName":       "Smith",
    "fullName":       "Jonathan Smith",
    "dateOfBirth":    "",
    "taxId":          "",
    "ssn":            "",
    "emails":         {},
    "phones":         {},
    "postalCode":     "",
    "dunsNumber":     "",
    "lei":            "",
    "nationalId":     "",
}

# ═══════════════════════════════════════════════════════════════════════════════
#  ▲▲▲  EDIT ABOVE WITH REAL VALUES FROM THE UI  ▲▲▲
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    diagnose(PARTY_02121414, PARTY_NT023512)
