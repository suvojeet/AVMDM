"""
Averio MDM — USPTO Patent Application Figures Generator
Produces FIG 1–8 as 300 DPI PNG files suitable for patent submission.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe
import numpy as np
import os

OUT_DIR = r"c:\Users\Rakhi Chatterjee\Documents\averio-mdm\docs\patent\figures"
os.makedirs(OUT_DIR, exist_ok=True)

DPI = 300
BG  = 'white'

# ── palette ────────────────────────────────────────────────────────────────────
C_DARK   = '#1E1B4B'   # deep indigo — title / header
C_MED    = '#4F46E5'   # violet — primary boxes
C_LIGHT  = '#EEF2FF'   # lavender tint — fill
C_ACC    = '#7C3AED'   # purple accent
C_GRN    = '#059669'   # emerald — success / pass
C_AMB    = '#D97706'   # amber — review / warning
C_RED    = '#DC2626'   # red — reject / fail
C_GRAY   = '#6B7280'   # grey — misc
C_LINE   = '#1F2937'   # near-black — arrows / borders
C_WHITE  = '#FFFFFF'

# ── low-level helpers ──────────────────────────────────────────────────────────

def save(fig, name, number):
    path = os.path.join(OUT_DIR, f"{name}.png")
    fig.savefig(path, dpi=DPI, bbox_inches='tight', facecolor=BG)
    plt.close(fig)
    print(f"  FIG {number}: {path}")

def box(ax, x, y, w, h, label, fc=C_LIGHT, ec=C_MED, lw=1.5,
        fontsize=8, bold=False, tc=C_DARK, radius=0.02, sublabel=None):
    rect = FancyBboxPatch((x - w/2, y - h/2), w, h,
                          boxstyle=f"round,pad=0.01,rounding_size={radius}",
                          facecolor=fc, edgecolor=ec, linewidth=lw, zorder=3)
    ax.add_patch(rect)
    weight = 'bold' if bold else 'normal'
    if sublabel:
        ax.text(x, y + h*0.12, label, ha='center', va='center',
                fontsize=fontsize, color=tc, fontweight=weight, zorder=4)
        ax.text(x, y - h*0.22, sublabel, ha='center', va='center',
                fontsize=fontsize-1, color=C_GRAY, zorder=4, style='italic')
    else:
        ax.text(x, y, label, ha='center', va='center',
                fontsize=fontsize, color=tc, fontweight=weight, zorder=4,
                wrap=True)
    return rect

def diamond(ax, x, y, w, h, label, fc=C_LIGHT, ec=C_AMB, lw=1.5, fontsize=7.5):
    dx, dy = w/2, h/2
    xs = [x,     x+dx, x,     x-dx, x]
    ys = [y+dy,  y,    y-dy,  y,    y+dy]
    ax.fill(xs, ys, fc=fc, zorder=3)
    ax.plot(xs, ys, color=ec, linewidth=lw, zorder=4)
    ax.text(x, y, label, ha='center', va='center',
            fontsize=fontsize, color=C_DARK, fontweight='bold', zorder=5)

def arrow(ax, x1, y1, x2, y2, label='', color=C_LINE, lw=1.2):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=color,
                                lw=lw, mutation_scale=10), zorder=5)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx+0.015, my, label, ha='left', va='center',
                fontsize=7, color=C_ACC)

def cylinder(ax, x, y, w, h, label, fc='#EDE9FE', ec=C_ACC, fontsize=8):
    ellipse_h = h * 0.18
    rect = mpatches.FancyBboxPatch((x - w/2, y - h/2), w, h,
                                    boxstyle="round,pad=0.0",
                                    facecolor=fc, edgecolor=ec, linewidth=1.5, zorder=3)
    ax.add_patch(rect)
    top = mpatches.Ellipse((x, y + h/2), w, ellipse_h,
                           facecolor=fc, edgecolor=ec, linewidth=1.5, zorder=4)
    bot = mpatches.Ellipse((x, y - h/2), w, ellipse_h,
                           facecolor=fc, edgecolor=ec, linewidth=1.5, zorder=4)
    ax.add_patch(top)
    ax.add_patch(bot)
    ax.text(x, y, label, ha='center', va='center',
            fontsize=fontsize, color=C_DARK, fontweight='bold', zorder=5)

def title_banner(ax, text, y=0.97):
    ax.text(0.5, y, text, transform=ax.transAxes, ha='center', va='top',
            fontsize=11, fontweight='bold', color=C_WHITE,
            bbox=dict(facecolor=C_DARK, edgecolor=C_DARK, pad=5,
                      boxstyle='round,pad=0.4'))

def caption(ax, number, text):
    ax.text(0.5, -0.02, f"FIG. {number} — {text}", transform=ax.transAxes,
            ha='center', va='top', fontsize=8, color=C_GRAY, style='italic')

# ══════════════════════════════════════════════════════════════════════════════
# FIG 1 — System Architecture
# ══════════════════════════════════════════════════════════════════════════════

def fig1_architecture():
    fig, ax = plt.subplots(figsize=(14, 10))
    ax.set_xlim(0, 14); ax.set_ylim(0, 10)
    ax.axis('off')
    ax.set_facecolor(BG)
    fig.patch.set_facecolor(BG)

    title_banner(ax, "FIG. 1  —  AVERIO MDM PLATFORM ARCHITECTURE")

    # ── Source Systems ─────────────────────────────────────────────────────────
    sources = ['CRM\nSystem', 'ERP\nSystem', 'Core\nBanking', 'Insurance\nPlatform', 'Regulatory\nReporting']
    sx = [1.2, 2.8, 4.4, 6.0, 7.6]
    for i, (lbl, x) in enumerate(zip(sources, sx)):
        box(ax, x, 9.0, 1.3, 0.7, lbl, fc='#F0FDF4', ec=C_GRN, fontsize=7, bold=True, tc='#065F46')

    ax.text(4.4, 9.6, 'SOURCE SYSTEMS', ha='center', va='center',
            fontsize=8, color=C_GRN, fontweight='bold')
    ax.add_patch(FancyBboxPatch((0.4, 8.55), 7.9, 1.2,
                 boxstyle="round,pad=0.05", fill=False, edgecolor=C_GRN, lw=1, linestyle='--', zorder=2))

    # ── Ingest API ─────────────────────────────────────────────────────────────
    box(ax, 4.4, 7.9, 4.0, 0.6, 'REST Ingest API  /api/v1/parties/ingest',
        fc='#EFF6FF', ec='#3B82F6', bold=True, fontsize=8, tc='#1D4ED8')
    for x in sx:
        arrow(ax, x, 8.55, 4.4, 8.2, color=C_GRN)

    # ── Ingest Pipeline ────────────────────────────────────────────────────────
    box(ax, 4.4, 7.1, 4.0, 0.6, 'PartyService.ingestParty()\n[4-path routing · status default · audit fields]',
        fc=C_LIGHT, ec=C_MED, bold=True, fontsize=7.5)
    arrow(ax, 4.4, 7.6, 4.4, 7.4)

    # ── Blocking Engine ────────────────────────────────────────────────────────
    box(ax, 1.8, 6.1, 2.8, 0.65, 'BlockingKeyService\n[9-Strategy Union · O(N×k)]',
        fc='#FEF3C7', ec=C_AMB, bold=True, fontsize=7.5, tc='#92400E')
    arrow(ax, 3.4, 7.1, 2.2, 6.45)

    # ── Matching Engine ────────────────────────────────────────────────────────
    box(ax, 6.0, 6.1, 3.0, 0.65, 'MatchingEngine\n[3-Stage: Det → Prob → AI]',
        fc='#F3E8FF', ec=C_ACC, bold=True, fontsize=7.5, tc='#581C87')
    arrow(ax, 5.4, 7.1, 5.8, 6.45)

    # ── EM Algorithm ──────────────────────────────────────────────────────────
    box(ax, 9.2, 6.1, 2.4, 0.65, 'EMAlgorithmService\n[Auto m/u estimation · nightly]',
        fc='#FCE7F3', ec='#DB2777', bold=True, fontsize=7.5, tc='#831843')
    arrow(ax, 7.5, 6.1, 8.0, 6.1, color=C_MED)
    ax.text(7.75, 6.2, 'm/u', ha='center', fontsize=7, color=C_ACC)

    # ── Survivorship Engine ────────────────────────────────────────────────────
    box(ax, 4.4, 5.2, 4.0, 0.65, 'SurvivorshipEngine\n[6 Rule Types · Query-Time Assembly]',
        fc='#ECFDF5', ec=C_GRN, bold=True, fontsize=7.5, tc='#065F46')
    arrow(ax, 4.4, 6.77, 4.4, 5.52)

    # ── Golden Record Service ──────────────────────────────────────────────────
    box(ax, 4.4, 4.35, 4.0, 0.65, 'GoldenRecordService\n[Provisional Identity · Drift Detection · Cache]',
        fc=C_LIGHT, ec=C_MED, bold=True, fontsize=7.5)
    arrow(ax, 4.4, 4.87, 4.4, 4.67)

    # ── Timeline + Steward ────────────────────────────────────────────────────
    box(ax, 2.0, 3.45, 2.6, 0.65, 'TimelineService\n[Event-Sourced Audit]',
        fc='#FFF7ED', ec='#EA580C', bold=True, fontsize=7.5, tc='#7C2D12')
    box(ax, 6.8, 3.45, 2.6, 0.65, 'StewardService\n[Review Queue · Decisions]',
        fc='#F0FDF4', ec=C_GRN, bold=True, fontsize=7.5, tc='#14532D')
    box(ax, 4.4, 3.45, 2.1, 0.65, 'MLMatchingService\n[LogReg · Feedback]',
        fc='#FCE7F3', ec='#DB2777', bold=True, fontsize=7.5, tc='#831843')

    arrow(ax, 3.4, 4.35, 2.6, 3.78)
    arrow(ax, 4.4, 4.02, 4.4, 3.78)
    arrow(ax, 5.4, 4.35, 6.2, 3.78)

    # ── Data Stores ────────────────────────────────────────────────────────────
    cylinder(ax, 2.0, 2.3, 2.2, 0.75, 'Neo4j\nGraph DB', fc='#EDE9FE', ec=C_ACC)
    cylinder(ax, 6.8, 2.3, 2.2, 0.75, 'Azure\nCosmos DB', fc='#EFF6FF', ec='#3B82F6')
    cylinder(ax, 4.4, 2.3, 2.0, 0.75, 'Blocking\nIndex\n(ConcurrentHashMap)', fc='#FEF3C7', ec=C_AMB)
    arrow(ax, 2.0, 3.12, 2.0, 2.68)
    arrow(ax, 4.4, 3.12, 4.4, 2.68)
    arrow(ax, 6.8, 3.12, 6.8, 2.68)

    # ── REST API Layer ─────────────────────────────────────────────────────────
    box(ax, 11.5, 7.5, 2.2, 2.6,
        'REST API\nSurface\n\n/parties\n/golden\n/ml/matching\n/governance\n/steward\n/test-lab',
        fc='#F8FAFC', ec=C_GRAY, fontsize=7, tc=C_DARK)

    # ── Test Laboratory ────────────────────────────────────────────────────────
    box(ax, 11.5, 5.2, 2.2, 1.4,
        'Test Laboratory\n7 Suites · 30+ Tests\nAuto-cleanup\nCosmos persistence',
        fc='#F5F3FF', ec=C_ACC, fontsize=7, tc=C_ACC, bold=True)

    # ── Legend ─────────────────────────────────────────────────────────────────
    legend_items = [
        (C_GRN,  'Source / Health'),
        (C_MED,  'Core MDM Engine'),
        (C_ACC,  'ML / AI Layer'),
        (C_AMB,  'Blocking Index'),
        (C_GRAY, 'Infrastructure'),
    ]
    for j, (clr, lbl) in enumerate(legend_items):
        ax.add_patch(FancyBboxPatch((9.0 + j*1.0, 1.3), 0.8, 0.35,
                     boxstyle="round,pad=0.05", facecolor=clr+'33', edgecolor=clr, lw=1.2, zorder=3))
        ax.text(9.4 + j*1.0, 1.48, lbl, ha='center', va='center', fontsize=6.5, color=C_DARK)

    caption(ax, 1, "Averio MDM Platform — Full System Architecture")
    save(fig, "FIG1_architecture", 1)

# ══════════════════════════════════════════════════════════════════════════════
# FIG 2 — 9-Strategy Blocking Key Generation
# ══════════════════════════════════════════════════════════════════════════════

def fig2_blocking():
    fig, ax = plt.subplots(figsize=(13, 9))
    ax.set_xlim(0, 13); ax.set_ylim(0, 9)
    ax.axis('off'); ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
    title_banner(ax, "FIG. 2  —  NINE-STRATEGY UNION BLOCKING KEY GENERATION")

    # Input
    box(ax, 6.5, 8.2, 3.5, 0.55, 'Input: Party Record  (name, DOB, phone, email, address, IDs)',
        fc='#EFF6FF', ec='#3B82F6', bold=True, fontsize=8, tc='#1D4ED8')

    # Name normalisation
    box(ax, 6.5, 7.45, 3.5, 0.55, 'NameNormalizerService.normalise()\n[strip suffixes · lowercase · collapse whitespace]',
        fc='#FEF9C3', ec='#CA8A04', fontsize=7.5)
    arrow(ax, 6.5, 7.92, 6.5, 7.72)

    # Fan out to 9 strategies
    strategies = [
        (1.0,  5.9, 'S1: Token DM\nDM:<code>',     C_MED,  C_LIGHT),
        (2.5,  5.9, 'S1b: Nickname\nvariant DM',    C_ACC,  '#F5F3FF'),
        (4.0,  5.9, 'S2: Full-name\nDMF:<code>',    C_MED,  C_LIGHT),
        (5.5,  5.9, 'S3: First-init\n+last phonetic',C_MED,  C_LIGHT),
        (7.0,  5.9, 'S4: DOB\nyear+month+init',     C_AMB,  '#FEF3C7'),
        (8.5,  5.9, 'S5: TaxID\nprefix TAX:<4>',    '#0891B2','#ECFEFF'),
        (10.0, 5.9, 'S6: Phone\nsuffix PH7:<7>',    '#0891B2','#ECFEFF'),
        (11.5, 5.9, 'S7: Email\ndomain+init',       '#0891B2','#ECFEFF'),
    ]
    for (x, y, lbl, ec, fc) in strategies:
        box(ax, x, y, 1.3, 0.9, lbl, fc=fc, ec=ec, fontsize=6.5)
        arrow(ax, 6.5, 7.17, x, 6.35, color=C_GRAY)

    # Extra strategies row
    box(ax, 2.5,  4.6, 1.4, 0.75, 'S8: ZIP+phonetic\nZIP:<5>:<code>', fc='#FEF3C7', ec=C_AMB, fontsize=6.5)
    box(ax, 4.5,  4.6, 1.4, 0.75, 'S9a: DUNS\nexact key', fc='#ECFDF5', ec=C_GRN, fontsize=6.5)
    box(ax, 6.0,  4.6, 1.4, 0.75, 'S9b: LEI\nexact key',  fc='#ECFDF5', ec=C_GRN, fontsize=6.5)
    box(ax, 7.5,  4.6, 1.4, 0.75, 'S9c: NationalID\nexact key', fc='#ECFDF5', ec=C_GRN, fontsize=6.5)
    for x in [2.5, 4.5, 6.0, 7.5]:
        arrow(ax, 6.5, 7.17, x, 4.97, color=C_GRAY)

    # Union box
    box(ax, 6.5, 3.6, 5.5, 0.65, 'UNION of all strategy key sets  →  Set<BlockingKey>',
        fc='#F3E8FF', ec=C_ACC, bold=True, fontsize=9, tc='#4C1D95')
    for x, y, *_ in strategies:
        arrow(ax, x, 5.45, 6.5, 3.93, color=C_MED)
    for x in [2.5, 4.5, 6.0, 7.5]:
        arrow(ax, x, 4.22, 6.5, 3.93, color=C_GRN)

    # Inverted index lookup
    box(ax, 4.0, 2.7, 3.5, 0.65, 'Inverted Index Lookup\nMap<key, Set<globalId>>  →  candidate buckets',
        fc='#EDE9FE', ec=C_ACC, fontsize=7.5)
    box(ax, 9.0, 2.7, 3.5, 0.65, 'Forward Index Update\nMap<globalId, Set<key>>  →  O(1) removal',
        fc='#EDE9FE', ec=C_ACC, fontsize=7.5)
    arrow(ax, 6.5, 3.28, 5.0,  3.02)
    arrow(ax, 6.5, 3.28, 10.0, 3.02)

    # Output
    box(ax, 4.0, 1.7, 3.5, 0.65, 'Candidate Pool\n(union of bucket members, probe excluded)',
        fc='#EFF6FF', ec='#3B82F6', bold=True, fontsize=8, tc='#1D4ED8')
    arrow(ax, 5.0, 2.37, 4.5, 2.02)

    box(ax, 9.0, 1.7, 3.5, 0.65, 'Index Maintenance\nindexParty() · removeParty() · rebuildAsync()',
        fc='#F0FDF4', ec=C_GRN, fontsize=7.5)

    # Complexity note
    ax.text(6.5, 0.9, 'Complexity: O(N²) → O(N×k)   where k ≈ 10–100 candidates per record',
            ha='center', fontsize=9, color=C_DARK,
            bbox=dict(facecolor='#F0F9FF', edgecolor='#0EA5E9', pad=4, boxstyle='round,pad=0.3'))

    caption(ax, 2, "Nine-Strategy Union Blocking Key Generation (BlockingKeyService)")
    save(fig, "FIG2_blocking", 2)

# ══════════════════════════════════════════════════════════════════════════════
# FIG 3 — Three-Stage Cascading Match Pipeline
# ══════════════════════════════════════════════════════════════════════════════

def fig3_pipeline():
    fig, ax = plt.subplots(figsize=(10, 13))
    ax.set_xlim(0, 10); ax.set_ylim(0, 13)
    ax.axis('off'); ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
    title_banner(ax, "FIG. 3  —  THREE-STAGE CASCADING MATCH PIPELINE")

    # Input
    box(ax, 5, 12.2, 5.5, 0.6, 'Incoming Party Record + Candidate Pool\n(from 9-Strategy Blocking Engine)',
        fc='#EFF6FF', ec='#3B82F6', bold=True, fontsize=8.5, tc='#1D4ED8')

    # ── STAGE 1 ────────────────────────────────────────────────────────────────
    ax.add_patch(FancyBboxPatch((0.5, 10.15), 9, 1.5,
                 boxstyle="round,pad=0.1", fill=True,
                 facecolor='#F0FDF4', edgecolor=C_GRN, lw=1.5, linestyle='--', zorder=1))
    ax.text(5, 11.85, 'STAGE 1 — DETERMINISTIC', ha='center', fontsize=9,
            fontweight='bold', color=C_GRN)
    box(ax, 5, 11.3, 7.5, 0.6,
        'Check: SSN · Tax ID · EIN · DUNS · LEI · Passport · National ID · (sourceSystem + sourceSystemId)',
        fc='#DCFCE7', ec=C_GRN, fontsize=7.5, tc='#14532D')
    arrow(ax, 5, 11.8, 5, 11.6)

    diamond(ax, 5, 10.5, 2.8, 0.55, 'Any ID\nexact match?', fc='#DCFCE7', ec=C_GRN)
    arrow(ax, 5, 10.22, 5, 9.83)

    # YES branch
    ax.text(6.55, 10.5, 'YES → score = 1.0', ha='left', fontsize=8, color=C_GRN, fontweight='bold')
    arrow(ax, 6.4, 10.5, 8.5, 10.5, color=C_GRN)
    box(ax, 9.0, 10.5, 1.0, 0.45, 'MATCH\nscore=1.0', fc='#DCFCE7', ec=C_GRN, fontsize=7, bold=True, tc='#14532D')

    # NO branch  → Stage 2
    ax.text(5.1, 9.95, 'NO', ha='left', fontsize=8, color=C_RED)

    # ── STAGE 2 ────────────────────────────────────────────────────────────────
    ax.add_patch(FancyBboxPatch((0.5, 7.7), 9, 2.0,
                 boxstyle="round,pad=0.1", fill=True,
                 facecolor='#F5F3FF', edgecolor=C_ACC, lw=1.5, linestyle='--', zorder=1))
    ax.text(5, 9.82, 'STAGE 2 — PROBABILISTIC (Fellegi-Sunter)', ha='center',
            fontsize=9, fontweight='bold', color=C_ACC)

    box(ax, 5, 9.3, 7.5, 0.6,
        'ProbabilisticMatcher: 20+ algorithms (JW · DL · Phonetic · Token Sort/Set · Bigram · TF-IDF · Nickname)',
        fc='#EDE9FE', ec=C_ACC, fontsize=7.5)
    arrow(ax, 5, 9.82, 5, 9.6)

    box(ax, 5, 8.65, 7.5, 0.6,
        'Fellegi-Sunter Log-Likelihood:  wₖ = γₖ·ln(mₖ/uₖ) + (1−γₖ)·ln((1−mₖ)/(1−uₖ))',
        fc='#EDE9FE', ec=C_ACC, fontsize=7.5, tc='#4C1D95')
    arrow(ax, 5, 8.97, 5, 8.95)

    box(ax, 5, 8.0, 7.5, 0.6,
        'EM-Learned m/u params (auto-calibrated nightly)  →  normalize to score ∈ [0,1]',
        fc='#EDE9FE', ec=C_ACC, fontsize=7.5)
    arrow(ax, 5, 8.32, 5, 8.3)

    # ── STAGE 3 (conditional) ─────────────────────────────────────────────────
    diamond(ax, 5, 7.3, 3.4, 0.6, 'score ∈ [0.5, 0.9]\nAND useAIEnhancement?', fc='#FEF3C7', ec=C_AMB)
    arrow(ax, 5, 7.7, 5, 7.6)

    ax.add_patch(FancyBboxPatch((0.5, 5.5), 9, 1.55,
                 boxstyle="round,pad=0.1", fill=True,
                 facecolor='#FFF7ED', edgecolor=C_AMB, lw=1.5, linestyle='--', zorder=1))
    ax.text(5, 7.17, 'STAGE 3 — AI-ENHANCED (conditional)', ha='center',
            fontsize=9, fontweight='bold', color=C_AMB)

    # YES → stage 3
    arrow(ax, 5, 7.0, 5, 6.9, color=C_AMB)
    ax.text(5.1, 7.05, 'YES', ha='left', fontsize=8, color=C_AMB, fontweight='bold')
    box(ax, 5, 6.55, 7.5, 0.65,
        'AIEnhancedMatcher: LLM prompt with structured record pair\n→ parse SCORE:<0.00-1.00>|REASON:<text>',
        fc='#FEF3C7', ec=C_AMB, fontsize=7.5, tc='#78350F')
    box(ax, 5, 5.85, 7.5, 0.55,
        'Blended score = 0.6 × probabilistic_score + 0.4 × ai_score   method = AI_ENHANCED',
        fc='#FEF3C7', ec=C_AMB, fontsize=7.5)
    arrow(ax, 5, 6.22, 5, 6.12)

    # NO → skip stage 3
    ax.text(6.75, 7.3, 'NO (skip)', ha='left', fontsize=8, color=C_GRAY)
    arrow(ax, 6.7, 7.3, 8.2, 5.6, color=C_GRAY)

    # ── THRESHOLD ROUTING ─────────────────────────────────────────────────────
    box(ax, 5, 5.0, 7.5, 0.55, 'Final Score + Best Candidate  →  Threshold-Driven Action Routing',
        fc=C_DARK, ec=C_DARK, bold=True, fontsize=8.5, tc=C_WHITE)
    arrow(ax, 5, 5.57, 5, 5.27)

    diamond(ax, 5, 4.35, 3.2, 0.6, 'score ≥ 0.95?', fc='#DCFCE7', ec=C_GRN)
    arrow(ax, 5, 4.72, 5, 4.65)

    # AUTO-LINK
    ax.text(6.75, 4.35, 'YES', ha='left', fontsize=8, color=C_GRN, fontweight='bold')
    arrow(ax, 6.6, 4.35, 7.8, 4.35, color=C_GRN)
    box(ax, 8.8, 4.35, 1.8, 0.55, 'AUTO_LINK\nSame golden ID', fc='#DCFCE7', ec=C_GRN, fontsize=7.5, bold=True, tc='#14532D')

    diamond(ax, 5, 3.55, 3.2, 0.6, 'score ≥ 0.75?', fc='#FEF3C7', ec=C_AMB)
    ax.text(5.1, 3.97, 'NO', ha='left', fontsize=8, color=C_RED)
    arrow(ax, 5, 4.05, 5, 3.85)

    # REVIEW
    ax.text(6.75, 3.55, 'YES', ha='left', fontsize=8, color=C_AMB, fontweight='bold')
    arrow(ax, 6.6, 3.55, 7.8, 3.55, color=C_AMB)
    box(ax, 8.8, 3.55, 1.8, 0.55, 'SEND_TO\nSTEWARD', fc='#FEF3C7', ec=C_AMB, fontsize=7.5, bold=True, tc='#78350F')

    # CREATE_NEW
    ax.text(5.1, 3.15, 'NO', ha='left', fontsize=8, color=C_RED)
    arrow(ax, 5, 3.25, 5, 2.95)
    box(ax, 5, 2.65, 3.5, 0.55, 'CREATE_NEW\nAssign new golden ID', fc='#FEE2E2', ec=C_RED, fontsize=7.5, bold=True, tc='#7F1D1D')

    # Provisional ID note
    ax.text(5, 1.9,
            '★  PROVISIONAL GOLDEN IDENTITY: SEND_TO_STEWARD path assigns a golden ID BEFORE commit\n'
            '      — no null golden state — record is available to downstream apps during entire review period',
            ha='center', fontsize=8, color=C_ACC,
            bbox=dict(facecolor='#F5F3FF', edgecolor=C_ACC, pad=5, boxstyle='round,pad=0.4'))

    caption(ax, 3, "Three-Stage Cascading Match Pipeline (MatchingEngine)")
    save(fig, "FIG3_pipeline", 3)

# ══════════════════════════════════════════════════════════════════════════════
# FIG 4 — EM Algorithm
# ══════════════════════════════════════════════════════════════════════════════

def fig4_em():
    fig, ax = plt.subplots(figsize=(12, 10))
    ax.set_xlim(0, 12); ax.set_ylim(0, 10)
    ax.axis('off'); ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
    title_banner(ax, "FIG. 4  —  SELF-CALIBRATING EM PARAMETER ESTIMATION (EMAlgorithmService)")

    # ── Input ─────────────────────────────────────────────────────────────────
    box(ax, 6, 9.2, 6, 0.6, 'Trigger: @Scheduled(cron="0 0 2 * * *")  or  POST /ml/matching/em-train',
        fc='#EFF6FF', ec='#3B82F6', bold=True, fontsize=8, tc='#1D4ED8')

    # ── Sampling ──────────────────────────────────────────────────────────────
    box(ax, 6, 8.4, 6, 0.65,
        'Sample N=5,000 random Party pairs from Neo4j golden records\n(reservoir sampling — no labels required)',
        fc=C_LIGHT, ec=C_MED, fontsize=7.5)
    arrow(ax, 6, 8.89, 6, 8.72)

    # ── Init ──────────────────────────────────────────────────────────────────
    box(ax, 6, 7.55, 6, 0.7,
        'Initialize:  m ← domain priors  ·  u ← domain priors  ·  π ← 0.01\n'
        '10 attributes: firstName · lastName · DOB · taxId · email · phone · orgName · postal · phonFN · phonLN',
        fc='#FEF9C3', ec='#CA8A04', fontsize=7.5, tc='#713F12')
    arrow(ax, 6, 8.07, 6, 7.89)

    # ── EM Loop box ────────────────────────────────────────────────────────────
    ax.add_patch(FancyBboxPatch((0.6, 4.5), 10.8, 2.85,
                 boxstyle="round,pad=0.15", fill=True,
                 facecolor='#F5F3FF', edgecolor=C_ACC, lw=2, linestyle='-', zorder=1))
    ax.text(6, 7.48, 'EM ITERATION LOOP', ha='center', fontsize=9,
            fontweight='bold', color=C_ACC)

    # E-step
    box(ax, 3.0, 6.8, 4.5, 0.9,
        'E-STEP\nlog_match = ln(π) + Σ[γₖ·ln(mₖ) + (1-γₖ)·ln(1-mₖ)]\n'
        'P(match) = softmax([log_match, log_nomatch])  [log-space stabilized]',
        fc='#EDE9FE', ec=C_ACC, fontsize=7, tc='#4C1D95')
    arrow(ax, 6, 7.19, 4.8, 7.25, color=C_ACC)

    # M-step
    box(ax, 9.0, 6.8, 4.5, 0.9,
        'M-STEP\nmₖ = Σ[P(matchᵢ)·γᵢₖ] / Σ[P(matchᵢ)]\nuₖ = Σ[(1-P(matchᵢ))·γᵢₖ] / Σ[(1-P(matchᵢ))]\nπ = mean(P(matchᵢ))',
        fc='#EDE9FE', ec=C_ACC, fontsize=7, tc='#4C1D95')
    arrow(ax, 5.25, 6.8, 6.75, 6.8, color=C_ACC)

    arrow(ax, 9.0, 6.35, 9.0, 5.3, color=C_ACC)

    diamond(ax, 6, 5.1, 3.8, 0.65, '‖Δm‖ + ‖Δu‖ < ε\nOR max iterations?', fc='#F5F3FF', ec=C_ACC)
    arrow(ax, 7.9, 5.1, 7.0, 5.1, color=C_ACC)

    # NO → loop back
    ax.text(5.1, 4.8, 'NO → next iteration', ha='left', fontsize=7.5, color=C_ACC)
    ax.annotate('', xy=(3.0, 6.35), xytext=(3.0, 4.78),
                arrowprops=dict(arrowstyle='->', color=C_ACC, lw=1.5, mutation_scale=10))
    ax.plot([3.0, 3.0], [4.78, 4.78], color=C_ACC, lw=1.5)
    ax.plot([3.0, 5.1], [4.78, 4.78], color=C_ACC, lw=1.5)

    arrow(ax, 6, 7.19, 6, 5.42, color=C_ACC)

    # YES → converged
    ax.text(4.35, 4.78, 'YES', ha='right', fontsize=8, color=C_GRN, fontweight='bold')
    arrow(ax, 4.1, 5.1, 2.5, 5.1, color=C_GRN)

    # ── Sanity guard ──────────────────────────────────────────────────────────
    box(ax, 6, 3.8, 6, 0.7,
        'SANITY GUARD:  if m > u  AND  m > 0.5  AND  u < 0.5  →  accept EM result\n'
        'otherwise  →  revert to domain priors',
        fc='#FEE2E2', ec=C_RED, fontsize=7.5, tc='#7F1D1D')
    arrow(ax, 6, 4.77, 6, 4.15)

    # ── Output ────────────────────────────────────────────────────────────────
    box(ax, 6, 3.0, 6, 0.65,
        'MUParameters(m[], u[], π, partyType, learnedAt)  →  ConcurrentHashMap<partyType, MUParameters>',
        fc='#ECFDF5', ec=C_GRN, bold=True, fontsize=7.5, tc='#14532D')
    arrow(ax, 6, 3.44, 6, 3.32)

    # ── Feed into scorer ──────────────────────────────────────────────────────
    box(ax, 6, 2.2, 6, 0.65,
        'ProbabilisticMatcher uses m/u in Fellegi-Sunter log-likelihood formula\n'
        'Fallback: domain priors if sanity guard rejects EM result',
        fc=C_LIGHT, ec=C_MED, fontsize=7.5)
    arrow(ax, 6, 2.67, 6, 2.52)

    # Attribute table
    attrs = ['firstName','lastName','DOB','taxId','email','phone','orgName','postal','phonFN','phonLN']
    m_pri = [0.95,0.92,0.88,0.99,0.85,0.82,0.90,0.75,0.89,0.86]
    u_pri = [0.15,0.10,0.02,0.01,0.03,0.04,0.08,0.12,0.14,0.09]
    tbl = ax.table(
        cellText=[[a, f'{m:.2f}', f'{u:.2f}'] for a,m,u in zip(attrs, m_pri, u_pri)],
        colLabels=['Attribute', 'Prior m', 'Prior u'],
        loc='lower right', bbox=[0.72, 0.01, 0.27, 0.32]
    )
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(7)
    for (row, col), cell in tbl.get_celld().items():
        if row == 0:
            cell.set_facecolor(C_DARK)
            cell.set_text_props(color='white', fontweight='bold')
        elif row % 2 == 0:
            cell.set_facecolor('#EDE9FE')
        cell.set_edgecolor('#D1D5DB')

    caption(ax, 4, "EM Parameter Estimation for Fellegi-Sunter m/u Probabilities")
    save(fig, "FIG4_em_algorithm", 4)

# ══════════════════════════════════════════════════════════════════════════════
# FIG 5 — Cluster Drift Detection
# ══════════════════════════════════════════════════════════════════════════════

def fig5_drift():
    fig, ax = plt.subplots(figsize=(11, 13))
    ax.set_xlim(0, 11); ax.set_ylim(0, 13)
    ax.axis('off'); ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
    title_banner(ax, "FIG. 5  —  POST-UPDATE PROBABILISTIC CLUSTER DRIFT DETECTION")

    box(ax, 5.5, 12.2, 7, 0.6, 'updateParty(globalId, updates, updatedBy)  →  party saved to Neo4j',
        fc='#EFF6FF', ec='#3B82F6', bold=True, fontsize=8.5, tc='#1D4ED8')

    box(ax, 5.5, 11.4, 7, 0.65,
        'reEvaluatePartyPlacement(savedParty, updatedBy)\nfind siblings in same golden cluster',
        fc=C_LIGHT, ec=C_MED, fontsize=7.5)
    arrow(ax, 5.5, 11.89, 5.5, 11.72)

    diamond(ax, 5.5, 10.65, 3.2, 0.65, 'siblings.isEmpty()', fc='#F9FAFB', ec=C_GRAY)
    arrow(ax, 5.5, 11.07, 5.5, 10.97)

    ax.text(7.25, 10.65, 'YES → return\n(sole member)', ha='left', fontsize=8, color=C_GRAY)
    arrow(ax, 7.1, 10.65, 8.5, 10.65, color=C_GRAY)
    box(ax, 9.5, 10.65, 1.8, 0.5, 'No action\n(trivial)', fc='#F9FAFB', ec=C_GRAY, fontsize=7.5)

    ax.text(5.6, 10.27, 'NO', ha='left', fontsize=8, color=C_RED)
    arrow(ax, 5.5, 10.32, 5.5, 10.1)

    box(ax, 5.5, 9.65, 7, 0.65,
        'matchingEngine.findMatches(updatedParty, siblings)\nextract bestSiblingScore',
        fc='#F3E8FF', ec=C_ACC, fontsize=7.5)
    arrow(ax, 5.5, 9.77, 5.5, 9.97)

    diamond(ax, 5.5, 8.9, 4.0, 0.65, 'bestSiblingScore\n≥ REVIEW_THRESHOLD (0.75)?', fc='#ECFDF5', ec=C_GRN)
    arrow(ax, 5.5, 9.32, 5.5, 9.22)

    ax.text(7.65, 8.9, 'YES → no drift', ha='left', fontsize=8, color=C_GRN, fontweight='bold')
    arrow(ax, 7.5, 8.9, 9.0, 8.9, color=C_GRN)
    box(ax, 9.9, 8.9, 1.8, 0.5, 'Return\n(in-cluster)', fc='#DCFCE7', ec=C_GRN, fontsize=7.5, bold=True, tc='#14532D')

    ax.text(5.6, 8.5, 'NO → DRIFT DETECTED', ha='left', fontsize=9, color=C_RED, fontweight='bold')
    arrow(ax, 5.5, 8.57, 5.5, 8.3)

    box(ax, 5.5, 7.85, 7, 0.65,
        '★  Full blocking search across ALL golden clusters\n'
        'matchingEngine.findMatchesWithBlocking(party)  →  externalCandidates',
        fc='#FEE2E2', ec=C_RED, fontsize=7.5, tc='#7F1D1D', bold=True)
    arrow(ax, 5.5, 8.15, 5.5, 8.17)

    diamond(ax, 5.5, 7.05, 4.0, 0.65, 'Best external score\n≥ AUTO_LINK (0.95)?', fc='#DCFCE7', ec=C_GRN)
    arrow(ax, 5.5, 7.52, 5.5, 7.37)

    # Branch A — Auto reassign
    ax.text(7.65, 7.05, 'YES', ha='left', fontsize=8, color=C_GRN, fontweight='bold')
    arrow(ax, 7.5, 7.05, 9.0, 7.05, color=C_GRN)
    box(ax, 9.9, 7.05, 1.8, 0.7, 'AUTO\nREASSIGN\nreassignToGolden()', fc='#DCFCE7', ec=C_GRN, fontsize=7, bold=True, tc='#14532D')
    ax.text(9.9, 6.55, '→ PARTY_LEFT_CLUSTER\n→ PARTY_JOINED_CLUSTER', ha='center', fontsize=6, color=C_GRN)

    ax.text(5.6, 6.65, 'NO', ha='left', fontsize=8, color=C_RED)
    arrow(ax, 5.5, 6.72, 5.5, 6.5)

    diamond(ax, 5.5, 5.9, 4.0, 0.65, 'Best external score\n≥ REVIEW (0.75)?', fc='#FEF3C7', ec=C_AMB)
    arrow(ax, 5.5, 6.22, 5.5, 6.22)

    # Branch B — Steward review
    ax.text(7.65, 5.9, 'YES', ha='left', fontsize=8, color=C_AMB, fontweight='bold')
    arrow(ax, 7.5, 5.9, 9.0, 5.9, color=C_AMB)
    box(ax, 9.9, 5.9, 1.8, 0.7, 'STEWARD\nESCALATION\ncreateReviewTask()', fc='#FEF3C7', ec=C_AMB, fontsize=7, bold=True, tc='#78350F')
    ax.text(9.9, 5.4, '→ CLUSTER_DRIFT\n   _REVIEW_REQUESTED', ha='center', fontsize=6, color=C_AMB)

    # Branch C — Detach
    ax.text(5.6, 5.5, 'NO', ha='left', fontsize=8, color=C_RED)
    arrow(ax, 5.5, 5.57, 5.5, 5.3)
    box(ax, 5.5, 4.9, 5.0, 0.65, 'DETACH: detachToNewGolden()\nCreate new golden ID for updated party',
        fc='#FEE2E2', ec=C_RED, fontsize=7.5, tc='#7F1D1D', bold=True)

    ax.text(2.0, 4.45, '→ PARTY_DETACHED_FROM_CLUSTER (old golden)', ha='left', fontsize=7, color=C_RED)
    ax.text(2.0, 4.15, '→ GOLDEN_CREATED_AFTER_DRIFT (new golden)', ha='left', fontsize=7, color=C_RED)

    # Always refresh old golden
    box(ax, 5.5, 3.55, 7, 0.6,
        'goldenRecordService.refreshGoldenRecord(oldGoldenId)\nUpdate surviving cluster without departed party',
        fc='#ECFDF5', ec=C_GRN, fontsize=7.5)
    arrow(ax, 5.5, 4.57, 5.5, 3.85)
    arrow(ax, 9.9, 5.57, 5.5, 3.85, color=C_AMB)
    arrow(ax, 9.9, 6.7,  5.5, 3.85, color=C_GRN)

    box(ax, 5.5, 2.75, 7, 0.6,
        'Timeline Events written to Cosmos DB partitioned by /entityId (goldenRecordId)',
        fc='#FFF7ED', ec='#EA580C', fontsize=7.5, tc='#7C2D12')
    arrow(ax, 5.5, 3.24, 5.5, 3.05)

    caption(ax, 5, "Post-Update Probabilistic Cluster Drift Detection (PartyService.reEvaluatePartyPlacement)")
    save(fig, "FIG5_drift_detection", 5)

# ══════════════════════════════════════════════════════════════════════════════
# FIG 6 — Data Model
# ══════════════════════════════════════════════════════════════════════════════

def fig6_data_model():
    fig, ax = plt.subplots(figsize=(14, 9))
    ax.set_xlim(0, 14); ax.set_ylim(0, 9)
    ax.axis('off'); ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
    title_banner(ax, "FIG. 6  —  ENTITY DATA MODEL ACROSS NEO4J AND COSMOS DB")

    # ── Neo4j store ────────────────────────────────────────────────────────────
    ax.add_patch(FancyBboxPatch((0.3, 1.5), 5.9, 6.8,
                 boxstyle="round,pad=0.1", fill=True,
                 facecolor='#EDE9FE', edgecolor=C_ACC, lw=2, zorder=1))
    ax.text(3.2, 8.45, 'NEO4J  GRAPH DATABASE', ha='center', fontsize=10,
            fontweight='bold', color=C_ACC)

    # Party node (source)
    fields_src = ['globalId (PK)', 'sourceSystem', 'sourceSystemId', 'partyType',
                  'firstName · lastName', 'dateOfBirth', 'taxId · SSN · EIN',
                  'DUNS · LEI · nationalId', 'phones · emails', 'addresses[]',
                  'status  ← "ACTIVE" default', 'isGolden = false',
                  'goldenRecordId → FK', 'matchScore · version']
    box(ax, 2.2, 5.4, 3.8, 4.2, '', fc='#F5F3FF', ec=C_ACC, lw=2)
    ax.text(2.2, 7.65, '«Node» Party (source record)', ha='center', fontsize=8.5,
            fontweight='bold', color=C_ACC)
    ax.plot([0.3, 4.1], [7.42, 7.42], color=C_ACC, lw=1)
    for j, f in enumerate(fields_src):
        ax.text(0.55, 7.2 - j*0.37, f'● {f}', fontsize=6.5, color=C_DARK)

    # Party node (golden)
    fields_gld = ['isGolden = true', 'confidenceScore', 'dataQualityScore', 'completenessScore']
    box(ax, 4.8, 6.5, 2.3, 1.9, '', fc='#DCFCE7', ec=C_GRN, lw=2)
    ax.text(4.8, 7.55, '«Golden flag»\nBest source', ha='center', fontsize=7.5,
            fontweight='bold', color=C_GRN)
    ax.plot([3.65, 5.95], [7.32, 7.32], color=C_GRN, lw=1)
    for j, f in enumerate(fields_gld):
        ax.text(3.75, 7.1 - j*0.3, f'◆ {f}', fontsize=6.5, color='#14532D')

    # Address node
    box(ax, 2.2, 2.35, 3.5, 1.3, '', fc='#FFF7ED', ec='#EA580C', lw=1.5)
    ax.text(2.2, 2.9, '«Node» Address', ha='center', fontsize=8,
            fontweight='bold', color='#EA580C')
    ax.plot([0.5, 3.9], [2.7, 2.7], color='#EA580C', lw=1)
    for j, f in enumerate(['street · city · state', 'postalCode · country']):
        ax.text(0.6, 2.5 - j*0.28, f'● {f}', fontsize=6.5, color=C_DARK)
    arrow(ax, 2.2, 3.3, 2.2, 3.38)
    ax.text(2.35, 3.35, ':HAS_ADDRESS', fontsize=6.5, color='#EA580C', style='italic')

    # ── Cosmos DB store ────────────────────────────────────────────────────────
    ax.add_patch(FancyBboxPatch((7.0, 1.5), 6.5, 6.8,
                 boxstyle="round,pad=0.1", fill=True,
                 facecolor='#EFF6FF', edgecolor='#3B82F6', lw=2, zorder=1))
    ax.text(10.25, 8.45, 'AZURE COSMOS DB  (NoSQL)', ha='center', fontsize=10,
            fontweight='bold', color='#1D4ED8')

    # GoldenRecord
    gr_fields = ['goldenRecordId (PK)', 'entityType = "PARTY"',
                 'goldenAttributes: Map<attr, GoldenAttribute>',
                 '  └ value · winningSource · rule · confidence',
                 '  └ candidates[]: {source,value,selected}',
                 'sourceRecords[]: {globalId,source,matchScore}',
                 'mergeHistory[]: {mergedId,survivingId,reason}',
                 'overallConfidenceScore', 'dataQualityScore · completenessScore',
                 'partitionKey = /entityType']
    box(ax, 10.25, 6.25, 5.8, 3.8, '', fc='#DBEAFE', ec='#3B82F6', lw=2)
    ax.text(10.25, 8.25, '«Container: golden-records»\nGoldenRecord document', ha='center',
            fontsize=8.5, fontweight='bold', color='#1D4ED8')
    ax.plot([7.35, 13.15], [8.02, 8.02], color='#3B82F6', lw=1)
    for j, f in enumerate(gr_fields):
        ax.text(7.45, 7.78 - j*0.35, f'● {f}', fontsize=6.5, color=C_DARK)

    # TimelineEvent
    tl_fields = ['eventId (PK)', 'entityId = goldenRecordId (PK)', 'eventType',
                 'previousValues: Map · newValues: Map',
                 'snapshotJson (full entity)', 'sourceSystem · changedBy',
                 'occurredAt (desc order)', 'partitionKey = /entityId']
    box(ax, 10.25, 3.15, 5.8, 2.9, '', fc='#FFF7ED', ec='#EA580C', lw=2)
    ax.text(10.25, 4.6, '«Container: timeline-events»\nTimelineEvent document', ha='center',
            fontsize=8.5, fontweight='bold', color='#C2410C')
    ax.plot([7.35, 13.15], [4.37, 4.37], color='#EA580C', lw=1)
    for j, f in enumerate(tl_fields):
        ax.text(7.45, 4.13 - j*0.33, f'● {f}', fontsize=6.5, color=C_DARK)

    # Matching Feedback
    box(ax, 10.25, 1.95, 5.8, 0.65, '«Container: matching-feedback»  MatchingFeedback\n'
        'partyId1·2 · label · featureVector[11] · decidedBy · scoreAtDecision  /entityType',
        fc='#FCE7F3', ec='#DB2777', fontsize=7, tc='#831843')

    # ── Relationships ──────────────────────────────────────────────────────────
    arrow(ax, 6.1, 5.4, 7.35, 5.4, color=C_MED)
    ax.text(6.5, 5.55, 'goldenRecordId\n→ FK', ha='center', fontsize=6.5, color=C_MED, style='italic')

    arrow(ax, 6.1, 4.2, 7.35, 3.8, color='#EA580C')
    ax.text(6.5, 4.1, 'triggers\ntimeline', ha='center', fontsize=6.5, color='#EA580C', style='italic')

    # Legend
    legend = [('Neo4j Node', C_ACC), ('Cosmos Doc', '#3B82F6'), ('Timeline', '#EA580C'),
              ('Feedback', '#DB2777'), ('Golden flag', C_GRN)]
    for j, (lbl, clr) in enumerate(legend):
        ax.add_patch(FancyBboxPatch((0.5 + j*2.0, 0.4), 1.7, 0.35,
                     boxstyle="round,pad=0.05", facecolor=clr+'22', edgecolor=clr, lw=1.2, zorder=3))
        ax.text(1.35 + j*2.0, 0.575, lbl, ha='center', va='center', fontsize=7, color=C_DARK)

    caption(ax, 6, "Entity Data Model — Neo4j (graph) and Azure Cosmos DB (documents)")
    save(fig, "FIG6_data_model", 6)

# ══════════════════════════════════════════════════════════════════════════════
# FIG 7 — Provisional Golden Identity Lifecycle
# ══════════════════════════════════════════════════════════════════════════════

def fig7_provisional():
    fig, ax = plt.subplots(figsize=(12, 11))
    ax.set_xlim(0, 12); ax.set_ylim(0, 11)
    ax.axis('off'); ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
    title_banner(ax, "FIG. 7  —  PROVISIONAL GOLDEN IDENTITY LIFECYCLE  (Novel Invention)")

    # NULL state comparison (prior art)
    ax.add_patch(FancyBboxPatch((0.3, 8.3), 5.0, 2.4,
                 boxstyle="round,pad=0.1", fill=True,
                 facecolor='#FEE2E2', edgecolor=C_RED, lw=2, zorder=1))
    ax.text(2.8, 10.85, 'PRIOR ART — Null Golden State (Problem)',
            ha='center', fontsize=9, fontweight='bold', color=C_RED)
    box(ax, 2.8, 10.2, 4.2, 0.5, 'Ingest → SEND_TO_STEWARD', fc='#FEE2E2', ec=C_RED, fontsize=8)
    arrow(ax, 2.8, 9.94, 2.8, 9.72, color=C_RED)
    box(ax, 2.8, 9.45, 4.2, 0.5, 'goldenRecordId = NULL  ← party saved', fc='#FEE2E2', ec=C_RED, fontsize=8)
    arrow(ax, 2.8, 9.19, 2.8, 8.97, color=C_RED)
    box(ax, 2.8, 8.7, 4.2, 0.5, '★ Invisible to downstream (days/weeks)', fc='#FEE2E2', ec=C_RED, fontsize=8, bold=True, tc=C_RED)

    # Present invention
    ax.add_patch(FancyBboxPatch((6.5, 8.3), 5.2, 2.4,
                 boxstyle="round,pad=0.1", fill=True,
                 facecolor='#DCFCE7', edgecolor=C_GRN, lw=2, zorder=1))
    ax.text(9.1, 10.85, 'PRESENT INVENTION — Provisional Identity (Solution)',
            ha='center', fontsize=9, fontweight='bold', color=C_GRN)
    box(ax, 9.1, 10.2, 4.2, 0.5, 'Ingest → SEND_TO_STEWARD', fc='#DCFCE7', ec=C_GRN, fontsize=8)
    arrow(ax, 9.1, 9.94, 9.1, 9.72, color=C_GRN)
    box(ax, 9.1, 9.45, 4.2, 0.5, 'provisionalGoldenId = generateGoldenId()', fc='#DCFCE7', ec=C_GRN, fontsize=8, bold=True, tc='#14532D')
    arrow(ax, 9.1, 9.19, 9.1, 8.97, color=C_GRN)
    box(ax, 9.1, 8.7, 4.2, 0.5, '★ Available IMMEDIATELY to downstream', fc='#DCFCE7', ec=C_GRN, fontsize=8, bold=True, tc=C_GRN)

    # Main flow
    box(ax, 6.0, 7.6, 8.0, 0.65,
        'party.setGoldenRecordId(provisionalGoldenId)  →  setIsGolden(false)  →  partyRepository.save()',
        fc=C_LIGHT, ec=C_MED, fontsize=7.5, bold=True)
    arrow(ax, 9.1, 8.44, 6.8, 7.92, color=C_GRN)

    box(ax, 6.0, 6.85, 8.0, 0.65,
        'goldenRecordService.createNewGoldenRecord(provisionalId, [saved])\n'
        '[Golden record fully assembled via survivorship engine — immediately queryable]',
        fc='#ECFDF5', ec=C_GRN, fontsize=7.5)
    arrow(ax, 6.0, 7.27, 6.0, 7.17)

    box(ax, 6.0, 6.1, 8.0, 0.65,
        'blockingKeyService.indexParty(saved)\n'
        '[Provisional party participates in future blocking candidate lookups]',
        fc='#F0FDF4', ec=C_GRN, fontsize=7.5)
    arrow(ax, 6.0, 6.52, 6.0, 6.42)

    box(ax, 6.0, 5.35, 8.0, 0.65,
        'createMatchReviewTask(saved, candidateGoldenId, score)\n'
        '[StewardTask: candidateIds = [existingCandidateGoldenId, provisionalGoldenId]]',
        fc='#FEF3C7', ec=C_AMB, fontsize=7.5)
    arrow(ax, 6.0, 5.77, 6.0, 5.67)

    # Steward decision diamond
    diamond(ax, 6.0, 4.5, 4.0, 0.7, 'Steward Decision', fc='#F3E8FF', ec=C_ACC)
    arrow(ax, 6.0, 5.0, 6.0, 4.85)

    # APPROVE
    ax.text(3.4, 4.7, 'APPROVE MERGE', ha='right', fontsize=8, color=C_GRN, fontweight='bold')
    arrow(ax, 4.0, 4.5, 2.5, 4.5, color=C_GRN)
    box(ax, 1.5, 3.75, 2.8, 1.3, '',  fc='#DCFCE7', ec=C_GRN)
    ax.text(1.5, 4.55, 'MERGE', ha='center', fontsize=8, fontweight='bold', color=C_GRN)
    ax.plot([0.15, 2.85], [4.32, 4.32], color=C_GRN, lw=1)
    ax.text(0.2, 4.1, 'mergeGoldenRecords(\n  survivingId,\n  provisionalId)', fontsize=6.5, color='#14532D')
    arrow(ax, 1.5, 3.09, 1.5, 2.7, color=C_GRN)
    box(ax, 1.5, 2.4, 2.8, 0.55, 'Party → survivingGoldenId\nProvisional ID retired', fc='#DCFCE7', ec=C_GRN, fontsize=7)

    # REJECT
    ax.text(8.6, 4.7, 'REJECT MERGE', ha='left', fontsize=8, color=C_RED, fontweight='bold')
    arrow(ax, 8.0, 4.5, 9.5, 4.5, color=C_RED)
    box(ax, 10.5, 3.75, 2.8, 1.3, '', fc='#FEE2E2', ec=C_RED)
    ax.text(10.5, 4.55, 'PROMOTE', ha='center', fontsize=8, fontweight='bold', color=C_RED)
    ax.plot([9.15, 11.85], [4.32, 4.32], color=C_RED, lw=1)
    ax.text(9.2, 4.1, 'Provisional ID\nbecomes PERMANENT\nno action needed', fontsize=6.5, color='#7F1D1D')
    arrow(ax, 10.5, 3.09, 10.5, 2.7, color=C_RED)
    box(ax, 10.5, 2.4, 2.8, 0.55, 'Party keeps provisional\nID as permanent entity', fc='#FEE2E2', ec=C_RED, fontsize=7)

    # Guarantee banner
    ax.text(6.0, 1.6,
            '◉  GUARANTEE:  Every party record has a golden identifier from the moment of first database commit.\n'
            '    The null golden state does not exist in this system.',
            ha='center', fontsize=9.5, color=C_GRN, fontweight='bold',
            bbox=dict(facecolor='#DCFCE7', edgecolor=C_GRN, pad=6, boxstyle='round,pad=0.5'))

    caption(ax, 7, "Provisional Golden Identity Lifecycle — eliminates null golden state (Novel)")
    save(fig, "FIG7_provisional_identity", 7)

# ══════════════════════════════════════════════════════════════════════════════
# FIG 8 — ML Feedback Loop
# ══════════════════════════════════════════════════════════════════════════════

def fig8_ml_feedback():
    fig, ax = plt.subplots(figsize=(12, 10))
    ax.set_xlim(0, 12); ax.set_ylim(0, 10)
    ax.axis('off'); ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
    title_banner(ax, "FIG. 8  —  HUMAN-IN-THE-LOOP ML RETRAINING PIPELINE")

    # Steward decision
    box(ax, 6, 9.2, 6.5, 0.65,
        'Steward makes MATCH or NO_MATCH decision on candidate pair\n'
        '(via StewardConsole UI or StewardService.executeResolution())',
        fc='#F0FDF4', ec=C_GRN, bold=True, fontsize=8, tc='#14532D')

    # Feature capture
    box(ax, 6, 8.3, 6.5, 0.7,
        '★  Feature capture at DECISION TIME  (not training time)\n'
        'extract: nameSimilarity · dobExactMatch · taxIdExactMatch · emailMatch · phoneMatch\n'
        '         addressSimilarity · dunsMatch · leiMatch · nationalIdMatch · sourceSystemDiversity · partyTypeMatch',
        fc='#FEF9C3', ec='#CA8A04', fontsize=7, tc='#713F12', bold=True)
    arrow(ax, 6, 8.87, 6, 8.64)

    # Persist feedback
    box(ax, 6, 7.4, 6.5, 0.65,
        'Persist MatchingFeedback to Cosmos DB\n'
        '{ partyId1, partyId2, label, featureVector[11], decidedBy, decidedAt, scoreAtDecision }',
        fc='#FCE7F3', ec='#DB2777', fontsize=7.5)
    arrow(ax, 6, 7.94, 6, 7.72)

    # Count check
    diamond(ax, 6, 6.65, 4.2, 0.7, 'feedbackCount ≥ MIN_EXAMPLES\nAND count % RETRAIN_EVERY == 0?',
            fc='#F3E8FF', ec=C_ACC)
    arrow(ax, 6, 7.07, 6, 7.0)

    ax.text(8.3, 6.65, 'NO → accumulate\n(min=5, every=5)', ha='left', fontsize=8, color=C_GRAY)
    arrow(ax, 8.1, 6.65, 9.5, 6.65, color=C_GRAY)

    ax.text(6.1, 6.27, 'YES → retrain', ha='left', fontsize=8, color=C_ACC, fontweight='bold')
    arrow(ax, 6, 6.3, 6, 6.1)

    # Build matrix
    box(ax, 6, 5.65, 6.5, 0.65,
        'Build feature matrix X ∈ ℝⁿˣ¹¹  and label vector y ∈ {0,1}ⁿ\n'
        'from all stored MatchingFeedback records',
        fc=C_LIGHT, ec=C_MED, fontsize=7.5)
    arrow(ax, 6, 5.97, 6, 5.97)

    # Logistic regression
    box(ax, 6, 4.75, 6.5, 0.8,
        'LOGISTIC REGRESSION TRAINING\n'
        'Gradient descent: up to 500 iterations · η = 0.1 · L2 λ = 0.01\n'
        'ŷ = σ(wᵀx)  ·  ∇L = Xᵀ(ŷ−y)/n + λw  ·  w ← w − η∇L',
        fc='#F3E8FF', ec=C_ACC, fontsize=7.5, tc='#4C1D95', bold=False)
    arrow(ax, 6, 5.32, 6, 5.14)

    # Metrics
    box(ax, 6, 3.85, 6.5, 0.7,
        'Compute metrics: Accuracy · Precision · Recall · F1\n'
        'Feature importance: |wᵢ| / Σ|wⱼ|  →  direction: POSITIVE / NEGATIVE / NEUTRAL',
        fc='#EFF6FF', ec='#3B82F6', fontsize=7.5)
    arrow(ax, 6, 4.34, 6, 4.19)

    diamond(ax, 6, 3.1, 3.5, 0.65, 'Metrics ≥\nacceptance threshold?', fc='#ECFDF5', ec=C_GRN)
    arrow(ax, 6, 3.5, 6, 3.42)

    # Accept
    ax.text(7.9, 3.1, 'YES', ha='left', fontsize=8, color=C_GRN, fontweight='bold')
    arrow(ax, 7.75, 3.1, 9.5, 3.1, color=C_GRN)
    box(ax, 10.5, 3.1, 1.8, 0.65, 'Deploy new\nMLMatchModel', fc='#DCFCE7', ec=C_GRN, fontsize=7.5, bold=True, tc='#14532D')

    # Reject
    ax.text(4.1, 2.7, 'NO → keep existing', ha='right', fontsize=8, color=C_RED)
    arrow(ax, 4.25, 3.1, 2.8, 3.1, color=C_RED)
    box(ax, 1.8, 3.1, 1.8, 0.65, 'Retain current\nMLMatchModel', fc='#FEE2E2', ec=C_RED, fontsize=7.5)

    # Active model feeds back
    box(ax, 6, 2.1, 6.5, 0.65,
        'Active MLMatchModel: getSoftMatchSuggestions()\n'
        'threshold: AUTO_LINK=0.85 · SOFT_MATCH=0.40  →  surfaces to StewardConsole',
        fc=C_LIGHT, ec=C_MED, fontsize=7.5)
    arrow(ax, 10.5, 2.77, 9.0, 2.42, color=C_GRN)

    # Loop back to steward
    ax.annotate('', xy=(6, 8.87), xytext=(6, 2.42),
                arrowprops=dict(arrowstyle='->', color='#9CA3AF', lw=1,
                                connectionstyle='arc3,rad=-0.4', mutation_scale=10))
    ax.text(10.4, 5.5, 'continuous\nfeedback loop', ha='center', fontsize=8,
            color=C_GRAY, style='italic', rotation=-90)

    # Key insight box
    ax.text(6, 1.2,
            '★  Key Innovation: Feature vectors captured at decision time — not at training time.\n'
            '    Party attribute changes after the decision do not corrupt the training signal.',
            ha='center', fontsize=9, color='#831843', fontweight='bold',
            bbox=dict(facecolor='#FCE7F3', edgecolor='#DB2777', pad=5, boxstyle='round,pad=0.4'))

    caption(ax, 8, "Human-in-the-Loop ML Retraining Pipeline (MLMatchingService)")
    save(fig, "FIG8_ml_feedback", 8)

# ══════════════════════════════════════════════════════════════════════════════
# RUN ALL
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("Generating patent figures...")
    fig1_architecture()
    fig2_blocking()
    fig3_pipeline()
    fig4_em()
    fig5_drift()
    fig6_data_model()
    fig7_provisional()
    fig8_ml_feedback()
    print(f"\nAll 8 figures saved to: {OUT_DIR}")
