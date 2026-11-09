# PTA3 → PTA3.5 Adaptation Plan

## Context

This plan implements the confirmed rule changes documented in `PTA3.5_RULE_DIFF.md` (read that
file first for full sourcing/evidence — this plan only summarizes what each phase does and why).

**Scope note — PTA3.5 is a rolling release.** Only the Player's Handbook and Nutshell Rules are
published today. The 3.5 Pokédex is "coming later 2026" and the GM's Guide + PHB2 are due 2027
(per the authors' official Linktree). This plan is split into:
- **Phases 1-5: buildable now** — core-rules changes sourced entirely from the PHB1/Nutshell Rules
  we have, independent of per-species Pokédex data. **All of Phases 1-5 are done** (2026-11-09) —
  full test suite and production build both verified passing.
- **Phase 6: blocked** — anything requiring the 3.5 Pokédex (Monster Die values, Style moves,
  per-species variable-dice moves). Do not guess at or back-fill this from the old Pokédex; wait
  for the book.
- **Phase 7: optional follow-up** — lower-priority verification work (full class-feature diff,
  full move-keyword audit) that doesn't block anything else.

---

## Phase 1 — Constants ✅ DONE

**File:** `src/data/constants.js`

- `CREATION_STAT_POINTS`: 25 → **30** (point-buy cost table itself is unchanged: 1/2/3/6/8/11).
- `DEFAULT_TRAINER.statPoints`: currently hardcoded as `10` (computed off the old 25-pt budget
  with a default 3/3/3/3/3 spread costing 15). Recompute for the 30-pt budget — still 15 spent on
  the default spread, so this becomes `15` unspent, not `10`. Update the comment above it too.
- `COMBAT_STAGE_FLAT_PER_STAGE`: delete or repurpose — see Phase 2. This constant no longer
  applies to Attack/Defense/SpAtk/SpDef at all; Speed needs its own constant (`±5`/stage) instead
  of reusing this one at a different value, since the two are now mechanically different (dice vs.
  flat-stat).
- No changes needed to: `MAX_TRAINER_LEVEL`, `CLASS_2/3/4_MIN_LEVEL`, `HONOR_THRESHOLDS`,
  `HP_MILESTONE_LEVELS`, `MAX_TOTAL_MOVES`, `STAB_BONUS`, `POINT_BUY_COSTS` — all confirmed
  unchanged in the diff.

---

## Phase 2 — Combat Stage Formulas ✅ DONE

**Implementation note:** the plan's file list undersold the scope — `src/hooks/useDiceRoller.js`
wasn't the only damage-roll pipeline. `src/components/battle/BattleTab.jsx` has its own parallel
`rollPokemonMove`/`rollSpecialMove` (Z-Moves, G-Max, Tera Blast) that also called the old
`applyCombatStage`, plus a `relevantStages` roll-history breakdown consumed by
`src/utils/discordEmbeds.js` for the Discord embed renderer — both needed the same dice-based
rewrite. All four files were updated together; see git history for the actual diff.

**Resolved design decisions:**
- Kept the stage UI as a free integer (no hard stacking enforcement in the UI) — recommendation
  (a) from this plan, left for the user to self-enforce the non-stacking rule.
- The attacker's own Attack/SpAttack/Defense/SpDefense stage is the only side modeled — this tool
  never tracked an opposing target's stat separately (confirmed: Defense/SpDefense stages were
  read into state but never consumed by the old damage math either), so RAW's "target's opposing
  Defense/SpDefense stage also contributes a die" isn't implemented. Documented in
  `getStageDiceDelta`'s doc comment (`dataUtils.js`) rather than silently ignored.
- Fixed a latent bug found while rewriting: `rollPokemonMove` (both copies) added the *raw* stat
  value into the damage total instead of `calcModifier(stat)` (half, rounded down) — pre-existing,
  independent of the 3.5 migration, now corrected since the function was being touched anyway.
- Updated all reference/help copy describing the old flat-stat formula: `GameRulesSection.jsx`,
  `HelpModal.jsx` (`combat-stages` entry).

**Files:** `src/utils/dataUtils.js`, `src/hooks/useDiceRoller.js`

This is the biggest mechanical change (see diff doc's "Combat — stages, damage, STAB" section).

### 2a. Attack / Defense / SpAtk / SpDef — dice-based, not stat-based

`applyCombatStage` currently returns a modified **stat value**
(`base + stages × 2`) that gets added into the damage total as if it were the stat bonus. In 3.5,
these four stats' stages **never touch the stat** — they add/remove **damage dice** instead:
- Attacker's own Attack▲/▼ adds/removes a die on their physical attacks.
- Target's Defense▼/▲ (from the defender's perspective) adds/removes a die on attacks against them.
- SpAtk/SpDef work identically for special attacks.
- With multiple targets having different Defense/SpDefense stages, the extra/removed die is
  rolled separately per target group (not shared).

This means `useDiceRoller.js`'s `rollPokemonMove` (`src/hooks/useDiceRoller.js:82-164`) needs
restructuring: the `statMod` line (`applyCombatStage(baseStat, stages)` added into `total`) goes
away for these four stats, replaced by adjusting `diceData.count` (± the net stage-derived dice)
before rolling. **Before touching this function, verify how the *stat bonus to damage* is
currently computed** — `rollPokemonMove` currently adds the raw `baseStat` (not
`calcModifier(baseStat)`) into `total` as `statMod`, which looks inconsistent with the rulebook's
"add half your stat, rounded down" rule (confirmed verbatim in both PTA3 and 3.5 text, and
`calcModifier` is already used elsewhere in this same file for trainer skill rolls). Confirm
whether this is an existing bug independent of the 3.5 migration before folding it into this
rewrite — fixing it is in scope either way since the function is being restructured regardless,
but it's a correctness bug to call out explicitly, not a silent side effect of the 3.5 change.

### 2b. Speed — stays flat, but ±5/stage instead of ±2/stage

Speed is the one stat where stages still modify the stat value directly. Change the magnitude from
±2 to **±5 per stage** (verbatim confirmed: "For each Speed▲ your Speed stat is +5... Speed▼...
is −5"). Add a dedicated constant (e.g. `SPEED_STAGE_FLAT_PER_STAGE = 5`) rather than reusing
`COMBAT_STAGE_FLAT_PER_STAGE`, since that constant no longer has a home for the other four stats.
Speed can't be lowered below a 10ft movement floor — confirm whether movement-speed display
elsewhere in the app needs this floor applied (search for where Pokémon movement speed, `speedFt`,
is calculated/displayed).

### 2c. Stacking rules — new, needs explicit modeling

Formalized rule (not present as a hard rule in old PTA3 text, only loose prose): same-sign stages
on one stat **don't stack** — applying Attack▲ while already at Attack▲ stays at Attack▲, it does
not become "▲▲". Opposite signs cancel 1-for-1. The one exception is moves phrased "Get Stat▲
(Max N)", which **can** stack up to N (and non-retroactively — an earlier plain ▲ doesn't
retroactively join a later "(Max N)" effect).

**Design decision needed before implementing:** the current `CombatStagesPanel.jsx` UI models each
stat as a free integer from −6 to +6 via +/− buttons. Under the new rule, a stat is realistically
only ever "has this stage or not" (effectively -1/0/+1) *unless* a specific move grants a
"(Max N)" stacking buff, which is move-specific and not something a generic UI panel can know
about generically. Decide (with the user) whether to:
  - (a) keep the UI as a free integer and let the user manually self-enforce the non-stacking rule
    (simplest, least invasive — this is a manual dice-roller tool, not a rules-enforcing engine), or
  - (b) cap the default per-stat range tighter (e.g. -1 to +1) with a manual override/note for
    "(Max N)" situations.
  Recommend (a) for a first pass — this tool has generally favored flexibility over enforcement
  elsewhere (see e.g. how move frequency isn't hard-capped either) — but confirm with the user
  before implementing, since it's a UX tradeoff, not a pure rules question.

### 2d. UI updates

**File:** `src/components/battle/CombatStagesPanel.jsx`
- Replace the `getModifiedStat` helper and its header text ("+1 stage = +2 to stat...") — the four
  non-Speed stats should display as "±N damage dice" instead of a modified stat number; Speed
  keeps the "base → modified" display but with the ±5 multiplier.
- The Accuracy/Evasion (`acc`/`eva`) stages tracked in this panel aren't sourced from either PTA3
  or PTA3.5 rulebook text found in this diff pass (no "Accuracy stage"/"Evasion stage" concept
  appears in either ruleset — the actual accuracy mechanic is a flat 1d20+stat vs. defense roll).
  This looks like a pre-existing house-rule extension, independent of the 3.5 migration. No
  changes planned here — flagging only so it isn't mistaken for a missed 3.5 rule during review.

---

## Phase 3 — Point-Buy Budget Propagation ✅ DONE

Also fixed: `src/utils/dataMigration.js`'s old-save migration clamp (hardcoded `Math.min(25, ...)`)
now uses the `CREATION_STAT_POINTS` constant instead of a literal; `HelpModal.jsx`'s point-buy
help entry and `GameRulesSection.jsx`'s trainer-rules reference copy both said "25 points".

**Files:** `src/data/constants.js` (Phase 1), any UI that surfaces "points remaining" during
trainer creation (likely `TrainerStats.jsx` or a creation-flow component — locate via grep for
`CREATION_STAT_POINTS` / `statPoints`).

Mechanical, low-risk — the cost table doesn't change, only the budget total. Verify no other
constant or copy (tooltips, help text) hardcodes "25 points" as a string.

---

## Phase 4 — New Move Keywords (reference content only) ✅ DONE

**File:** `src/components/reference/GameRulesSection.jsx` (per CLAUDE.md Phase 10, this is the
component that already documents rules content).

Three new move keywords confirmed in 3.5 with no equivalent in old PTA3: **Lethal** (crit on
natural 19-20 instead of just 20, usable once per combat), **Latched** (bite-based: stay adjacent
to avoid a penalty, moving away triggers one), and **Stance** (a move marks a persistent
passive-while-active state; only one Stance active at a time).

**Implementation note:** added a new "Move Keywords" accordion section to `GameRulesSection.jsx`
(there wasn't one before) with all three new keywords clearly marked "(new in 3.5)", plus the
confirmed-unchanged keywords (Priority, Reaction, Recharge, Multi-Turn, Scatter, Coat, Hazards) for
coherence — a glossary with only 3 entries and no context for why would read as arbitrary. Also
fixed stale header copy in the same file/component ("PTA3" / "3rd Edition" → "PTA3.5") since the
section content underneath was already PTA3.5-accurate after Phases 2-3. No data-model changes —
this is reference text only, matching the plan's original scope (no per-move keyword tagging exists
anywhere, and that's correctly deferred to Phase 6 once the Pokédex ships).

---

## Phase 5 — Verification Pass (low-effort, closes remaining diff-doc open questions) ✅ DONE

- **Neutral natures**: already resolved while drafting this plan — `src/data/configs.js` already
  has all 5 neutral natures (Hardy/Docile/Serious/Bashful/Quirky, `buff: null, nerf: null`). No
  action needed; the 3.5 handbook's 20-nature table just excludes them because you can't roll a
  neutral nature off a d20-of-stat-pairs table, not because they were removed.
- **`getSpeedSkillMod` helper**: resolved during Phase 2 — it had zero callers anywhere in `src`
  (dead code even before the 3.5 migration) and no source was found for it in either ruleset's
  text, so it was deleted rather than updated.

---

## Phase 6 — BLOCKED until the PTA3.5 Pokédex ships ("later 2026")

Do not start this phase until the 3.5 Pokédex is published and added to `reference material/`.
When it ships, this becomes the Phase-12-equivalent of the original PTA3 adaptation
(`pokedex.min.json` re-extraction), plus these new, confirmed-required schema additions:

- **`monsterDie` field per species** (e.g. `"d6"`), shown in the 3.5 handbook as a required part
  of every stat block ("Pikachu — d6"), used to resolve any move in that species' list whose power
  is written as "Xd" with no die size. Confirmed to change on evolution (Gastrodon/Toxicroak
  examples). This is the single largest data-migration item in the whole 3.5 adaptation — a large
  fraction of all moves use this form, not just a handful of signature attacks.
- **Style moves**: a new non-damaging move category, one per Pokémon max, occupies one of the 6
  move slots. Needs a schema field (e.g. `category: "style"`) and a move-learning UI rule enforcing
  the 1-Style cap independently of the 6-move cap (`MoveLearnModal.jsx`).
- Re-verify whether `pokedex.min.json`'s existing move frequency strings, skills, and passives
  format (CLAUDE.md Phase 12) still match 3.5, since the whole file will need re-extraction anyway.

---

## Phase 7 — Optional follow-up (not blocking, do opportunistically)

- **Full class-feature text diff**: only class *unlock mechanics* (Lv 3/7/11) and cross-class
  *prerequisites* were verified as unchanged. The actual level-by-level feature text for all 7 base
  + 35 advanced classes in `src/data/configs.js`'s `trainerClasses` wasn't diffed — if any wording
  changed, that data would need updates even though unlock levels don't.
- **Full Move Keywords audit**: Binding/Coat/Hazards/Multi-Turn/Priority/Reaction/Scatter/
  Terrain/Weather were sample-verified as present in both rulesets; a line-by-line diff of their
  exact text wasn't done (only Lethal/Latched/Stance were confirmed as wholly new).

---

## Critical Files

| File | Phase | Change Type | Status |
|---|---|---|---|
| `src/data/constants.js` | 1 | Point-buy budget 25→30, `COMBAT_STAGE_FLAT_PER_STAGE` → `SPEED_STAGE_FLAT_PER_STAGE` (5) | ✅ Done |
| `src/utils/dataUtils.js` | 2 | `applyCombatStage`→`applySpeedCombatStage`+`getStageDiceDelta` split; removed dead `getSpeedSkillMod`/`getCombatStagePercent` | ✅ Done |
| `src/hooks/useDiceRoller.js` | 2 | `rollPokemonMove`: dice-count adjustment instead of stat-mod; fixed raw-stat-as-bonus bug | ✅ Done |
| `src/components/battle/BattleTab.jsx` | 2 | Same rewrite for its parallel `rollPokemonMove`/`rollSpecialMove` (Z-Move/G-Max/Tera Blast) — found during implementation, not in original file list | ✅ Done |
| `src/utils/discordEmbeds.js` | 2 | New `isDice` stage-display mode for the roll-history embed | ✅ Done |
| `src/components/battle/CombatStagesPanel.jsx` | 2 | Dice-based display for 4 stats, ±5/stage for Speed | ✅ Done |
| `src/utils/dataMigration.js` | 3 | Old-save `statPoints` clamp now uses `CREATION_STAT_POINTS` instead of hardcoded 25 | ✅ Done |
| `src/components/modals/HelpModal.jsx` | 2, 3 | Point-buy budget copy, Combat Stages help entry rewrite | ✅ Done |
| `src/components/reference/GameRulesSection.jsx` | 2, 3 | Point-buy budget copy, Combat Stages reference rewrite | ✅ Done |
| `src/components/trainer/TrainerProfile.jsx` | 3 | Comment-only fix (25→30) | ✅ Done |
| `src/utils/__tests__/dataUtils.test.js`, `src/components/battle/__tests__/CombatStagesPanel.test.jsx`, `src/utils/__tests__/dataMigration.test.js` | 2, 3 | Updated to PTA3.5 expectations | ✅ Done |
| `src/components/reference/GameRulesSection.jsx` | 4 | Optional: Lethal/Latched/Stance glossary entries | Not started |
| `src/data/configs.js` | 5, 7 | Verify (no change needed for natures — confirmed) ; class-feature text follow-up | Natures verified; class-feature diff not started |
| `pokedex.min.json`, `src/data/pokedexLoader.js`, `src/components/modals/MoveLearnModal.jsx` | 6 (blocked) | Monster Die, Style moves — wait for 3.5 Pokédex | Blocked |
