# PTA3.5 Dex — Pokémon Tabletop Adventures 3.5 Character Manager

A fan-made, non-commercial web application for managing trainers, Pokémon, stats, moves, and game data for the **Pokémon Tabletop Adventures 3.5 (PTA3.5)** tabletop RPG system.

This tool replaces spreadsheets and manual note-taking with a clean, interactive interface designed for long-running PTA3.5 campaigns.

> Forked from [pta3-dex](https://github.com/leander-r/pta3-dex) to track the PTA3.5 ruleset update. Rule content below still reflects PTA3 until the 3.5 adaptation work lands.

> **Live Demo:** [https://leander-r.github.io/pta3.5-dex/](https://leander-r.github.io/pta3.5-dex/)

---

## Features

### Trainer Management
- **Profile & Stats** — Name, age, level, gender, and five core stats (ATK, DEF, SATK, SDEF, SPD) on a 1–10 scale with point-buy creation tracking (25 pts)
- **HP** — Base 20 HP; rolls a 1d4 bonus at milestone levels 3, 7, and 11
- **Stat Increases** — At levels 3, 7, and 11, raise two different stats by 1 each
- **Modifier** — `⌊stat / 2⌋` displayed alongside each stat
- **Classes & Features** — Up to four trainer classes (unlocked at Lv 1 / 3 / 7 / 11) chosen from 7 base and 35 advanced classes; 509 class features from both handbooks
- **Skills** — 18 PTA3 skills grouped by stat; talent bonus: 0 talents → +0, 1 talent → +2, 2 talents → +5; Concentration and Constitution are passive
- **Honor Leveling** — Gain honors (gym badges, ribbons, etc.) to advance; max level 15
- **Equipment** — Equip armor, weapons, and clothing from the item database; stat bonuses applied automatically
- **Badges** — Track gym badges
- **Money** — Track Pokédollars (₽)

### Pokémon Team
- **Party & Reserve** — Up to 6 active Pokémon plus an unlimited reserve box
- **Stats from Pokédex** — All base stats (HP, ATK, DEF, SATK, SDEF, SPD) are fixed species values from the Pokédex; no per-level allocation
- **Nature Modifier** — ±1 to one stat; displayed with color highlight
- **Move Management** — Single pool of up to 6 moves (no natural/taught distinction); move-learning modal with frequency labels (At-Will / 3/day / 1/day)
- **Special Forms** — Alpha, Totem, Titan, Shadow, and Purified variants with unique mechanics; shiny cosmetic toggle
- **Evolution Tracking** — View evolution chains; one-click evolve and devolve
- **Abilities** — Basic, Advanced, and Hidden abilities per species
- **Regional Forms** — Alolan, Galarian, Hisuian, and Paldean forms with correct sprites
- **Custom Moves & Species** — Create homebrew moves and entirely new species for your campaign
- **Comparison** — Side-by-side stat comparison for two Pokémon

### Battle Tools
- **Dice Roller** — Roll move damage or trainer skill checks with full history
- **Combat Stages** — Track stat modifiers (−6 to +6) per Pokémon; each stage = flat ±2 to stat
- **HP Tracking** — Current HP and damage for each party member
- **STAB** — Fixed +4 bonus applied automatically
- **Z-Moves** — Activate Z-Move for a one-time powered-up attack (1/battle); species-specific Z-Moves supported
- **Dynamax / Gigantamax** — Double HP scaling, Max Move table, Gigantamax form visuals (1/battle)
- **Terastallization** — Tera Type selector per Pokémon; Tera Blast uses typed STAB
- **Discord Integration** — Send roll results to a channel via webhook

### Inventory
- **Item Management** — Add, remove, and adjust quantities
- **Item Database** — Browse and search the full PTA item database
- **Category Filters** — Filter by item type (Healing, Poké Balls, Held Items, etc.)

### GM Tools
- **Capture Calculator** — Dynamic catch rate based on Pokémon rarity, HP %, and ball type
- **Encounter Guide** — Special encounter types (Alpha, Totem, Titan, Shadow, Purified) with full mechanics; wild nature roller
- **Rewards & Loot** — Filler encounter tables and reward guidelines by level range
- **Gym Guide** — Badge-count difficulty scaling, Gym Leader stat passives, Elite Four passives, and trainer features
- **NPC Stat Blocks** — Instant stat block generator for Junior, Experienced, and Veteran NPC trainers across 7 classes
- **Contest Tracker** — Heart Points grid, Star Points awards, and NPC competitor d20 roller for all 5 contest types

### Quick Reference
- **Pokédex Browser** — Look up any of 1084 species' base stats, capabilities, passives, and moves (with type, frequency, and damage); legendary entries marked with ⭐; search by name or filter by type
- **Type Chart** — Interactive type effectiveness chart
- **Natures** — All 25 natures with ±1 modifier reference
- **Moves Database** — Searchable and filterable database of all moves
- **Abilities Database** — Browse all Pokémon abilities
- **Game Rules** — Quick reference for PTA3 rules (stat checks, damage, HP, combat stages)

### Share & Export
- **Export Cards** — Generate trainer and Pokémon cards as shareable images
- **Print Character Sheet** — Opens a print-ready HTML page (auto-triggers browser print dialog)
- **Export Trainer JSON** — Save a single trainer as a JSON backup
- **Export All Data** — Full backup of all trainers and inventory
- **Import Data** — Restore from any previously exported JSON file; old-format saves are auto-migrated to PTA3 on load
- **Discord Embeds** — Copy trainer and team info as formatted Discord messages

### Data & User Experience
- **Auto-Save** — All changes saved instantly to localStorage; no Save button needed
- **Save Slots** — Three named save slots plus an auto-backup for point-in-time snapshots
- **Multi-Trainer** — Manage multiple trainers; clone or archive characters
- **Dark Mode** — Toggle between light and dark themes; preference persists across sessions
- **Compact Mode** — Tighter layout for smaller screens
- **Responsive Design** — Works on desktop, tablet, and mobile (bottom navigation bar on mobile)
- **Contextual Help** — In-app help topics for stats, classes, move slots, combat stages, and more

---

## PTA3 Rules Reference

| Rule | Value |
|------|-------|
| Trainer stats | 5 (ATK / DEF / SATK / SDEF / SPD), scale 1–10 |
| Creation points | 25 (point-buy: 1→1pt, 2→2pt, 3→3pt, 4→6pt, 5→8pt, 6→11pt) |
| Creation cap | 6 per stat |
| Stat modifier | `⌊stat / 2⌋` |
| Trainer HP | 20 base + 1d4 at Lv 3 / 7 / 11 |
| Stat increase | +1 to two different stats, only at Lv 3 / 7 / 11 |
| Class slots | Lv 1 / 3 / 7 / 11 |
| Max trainer level | 15 (honor-based) |
| Skill check | 1d20 + modifier + talent bonus (+2 or +5) |
| Pokémon HP | Fixed species value from Pokédex |
| Nature modifier | ±1 to one stat |
| Move cap | 6 total |
| STAB | Fixed +4 |
| Combat stage | Flat ±2 per stage |
| Type effectiveness | +1 / −1 die (super effective / resistant) |

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server |
| **Context API** | State management |
| **LocalStorage** | Trainer data persistence |
| **IndexedDB** | Pokédex data caching |
| **html2canvas** | Card image export |
| **Playwright** | End-to-end tests |
| **Vitest** | Unit tests |

---

## Getting Started

### Use Online (Recommended)

Visit the live site: **[https://leander-r.github.io/pta3.5-dex/](https://leander-r.github.io/pta3.5-dex/)**

No installation required — works in any modern browser.

### Run Locally

**Prerequisites:** [Node.js](https://nodejs.org/) v18 or higher

```bash
git clone https://github.com/leander-r/pta3.5-dex.git
cd pta3.5-dex
npm install
npm run dev        # dev server at http://localhost:5173
```

```bash
npm run build      # production build
npm run preview    # preview the production build
npm run test:run   # unit tests (Vitest)
npm run test:e2e   # end-to-end tests (Playwright)
```

---

## Usage Guide

### Creating Your First Trainer

1. Open the **Trainer** tab — a default trainer is ready to edit
2. Set your trainer's name, age, and gender
3. Allocate the 25 creation stat points using point-buy (max 6 per stat at creation)
4. Add a trainer class; pick your class-granted skill talents in the skill picker
5. At levels 3, 7, and 11 raise two different stats by 1 each, and roll a 1d4 HP bonus

### Adding Pokémon to Your Team

1. Go to the **Pokémon** tab and click **Add Pokémon**
2. Search for a species by name
3. Set level, nature, and nickname — stats come directly from the Pokédex entry
4. Add up to 6 moves from the species' move pool
5. Collapse the card when done; it stays in your party

### Battle & Dice Roller

1. Go to the **Battle** tab
2. Select **Pokémon** mode to roll move damage, or **Trainer** mode for skill checks (1d20 + modifier + talent bonus)
3. Adjust combat stages with the ± buttons; each stage adds or subtracts 2 flat from the stat
4. Track HP damage directly on each Pokémon's combat row

### Exporting & Printing

Export actions live in the **Share & Export** section at the bottom of the sidebar:

- **Export Cards** — generate image cards for your trainer or Pokémon
- **Print Sheet** — opens a print-ready page; choose *Save as PDF* in the browser print dialog

JSON backups and the Import option are available via the **☰ menu** in the header.

### Multiple Trainers

- **☰ menu → New Trainer** to create another character
- Use the **trainer dropdown** in the header to switch
- **Clone Trainer** duplicates the active trainer
- **Archive Trainer** hides a trainer without deleting them

---

## Project Structure

```
pta3.5-dex/
├── src/
│   ├── components/
│   │   ├── battle/        # Dice roller & combat tools
│   │   ├── common/        # Header, navigation, modals container
│   │   ├── gm/            # GM Tools (capture, encounter, rewards, gym, NPC, contest)
│   │   ├── inventory/     # Item management
│   │   ├── modals/        # All modal dialogs
│   │   ├── notes/         # Campaign notes
│   │   ├── pokemon/       # Pokémon cards & management
│   │   ├── reference/     # Pokédex browser, type chart, moves, etc.
│   │   └── trainer/       # Trainer profile & stats
│   ├── contexts/          # React context providers
│   ├── data/              # Game data, constants, loaders
│   ├── hooks/             # Custom React hooks
│   ├── styles/            # Global CSS
│   └── utils/             # Utility functions (sprites, export, migration…)
├── scripts/               # Data generation scripts (Pokédex & legendary parsers)
├── pokedex.min.json       # 1084 Pokémon species entries (PTA3 format, incl. legendaries)
├── pta-game-data.min.json # PTA3 rules data (natures, skills, classes, 509 features…)
└── index.html
```

---

## License

The source code is released under the **MIT License** — see [LICENSE](LICENSE) for the full text.

### Trademark Notice

Pokémon, Pokémon character names, Nintendo, Game Freak, and all related marks are trademarks of Nintendo, Game Freak, Creatures Inc., and The Pokémon Company. This is an **unofficial fan-made tool** and is not affiliated with, endorsed by, or connected to any of those entities. No copyright infringement is intended.

---

## Attribution

- **Pokémon sprites** sourced from the [Pokémon Showdown](https://github.com/smogon/pokemon-showdown-client) open-source project; sprites are the property of Nintendo / Game Freak / The Pokémon Company.
- **PTA3 System** — game rules and data from the Pokémon Tabletop Adventures 3 community rulebooks.
- **Developer:** [leander_rsr](https://github.com/leander-r)
- **AI Assistance:** Development aided by Claude (Anthropic) for iteration, refactoring, and UI work.

---

*Made with ❤️ for the PTA3 community*
