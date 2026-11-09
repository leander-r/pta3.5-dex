import React from 'react';
import useModalKeyboard from '../../hooks/useModalKeyboard.js';
import { useUI } from '../../contexts/index.js';

export const HELP_CONTENT = {
    'stat-allocation': {
        title: 'Trainer Stats',
        body: () => (
            <>
                <p>Trainers have <strong>5 stats</strong> (ATK, DEF, SATK, SDEF, SPD) on a <strong>1–10 scale</strong>. Each stat has a <strong>modifier = ⌊stat ÷ 2⌋</strong> used in skill rolls and accuracy checks. HP is separate and fixed at 20 base.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Creation Point-Buy (30 pts)</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li>Stat 1 = 1 pt &nbsp;|&nbsp; Stat 2 = 2 pts &nbsp;|&nbsp; Stat 3 = 3 pts</li>
                    <li>Stat 4 = 6 pts &nbsp;|&nbsp; Stat 5 = 8 pts &nbsp;|&nbsp; Stat 6 = 11 pts</li>
                    <li>Maximum of <strong>6</strong> in any stat at creation</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Milestone Stat Points</h4>
                <p>At levels <strong>3, 7, and 11</strong> you gain <strong>2 stat points</strong> to spend immediately. Each of those 2 points <strong>must go to a different stat</strong> — you cannot put both into the same stat at once.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Undo</h4>
                <p>The <strong>↩ Undo</strong> button restores the last stat change so you can experiment freely before committing.</p>
            </>
        )
    },
    'classes': {
        title: 'Trainer Classes',
        body: () => (
            <>
                <p>Classes define your trainer's playstyle and unlock unique <strong>features</strong> and <strong>skill talents</strong>.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Class Slots</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Lv 1:</strong> 1st class</li>
                    <li><strong>Lv 3:</strong> 2nd class</li>
                    <li><strong>Lv 7:</strong> 3rd class</li>
                    <li><strong>Lv 11:</strong> 4th class</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Base vs Advanced</h4>
                <p>Your <strong>first class</strong> must be one of the 7 Base classes. Additional slots unlock Advanced classes. Each class provides a <strong>skill pool</strong> — you gain talents in skills from that pool (max 2 talents per skill).</p>
            </>
        )
    },
    'origin': {
        title: 'Trainer Origin',
        body: () => (
            <>
                <p>Your <strong>Origin</strong> (HB1 pp. 90-99) is the life you lived before becoming a trainer — Academic, Athlete, Doctor, Grunt, and 11 others. It's chosen once at character creation, alongside your class.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>What it grants</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>2-3 skill talents</strong> from the origin's skill list</li>
                    <li>One free <strong>Origin Feature</strong> (added to your Features list)</li>
                </ul>
                <p>Starting lifestyle, credits, equipment, and Pokémon are shown as reference text — apply those to your inventory/roster yourself, since they're one-time chargen choices rather than ongoing state.</p>
                <p>Changing your Origin removes its granted skills and feature and lets you pick a new one.</p>
            </>
        )
    },
    'move-slots': {
        title: 'Move Slots',
        body: () => (
            <>
                <p>Each Pokémon can know up to <strong>6 moves</strong> in a single pool — there is no distinction between Natural and Taught moves.</p>
                <p style={{ margin: '10px 0' }}>Moves come directly from the species' Pokédex entry. Frequencies are <strong>At-Will</strong>, <strong>3/day</strong>, or <strong>1/day</strong>.</p>
                <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Tip: When all 6 slots are full, you'll be prompted to replace an existing move before learning a new one.</p>
            </>
        )
    },
    'combat-stages': {
        title: 'Combat Stages',
        body: () => (
            <>
                <p>Combat Stages track temporary <strong>buffs and debuffs</strong> applied by moves during battle.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>ATK / DEF / SATK / SDEF: Damage Dice, Not Stat</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>+1 stage</strong> = +1 damage die on the relevant attack</li>
                    <li><strong>−1 stage</strong> = −1 damage die on the relevant attack</li>
                    <li>Example: a move rolling 3d8 with Attack▲ rolls 4d8 instead — the stat itself doesn't change</li>
                    <li>If stages remove every die, the move deals only its stat bonus + STAB</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Speed: Still Flat to the Stat</h4>
                <p>Speed is the one exception — each stage is still a flat <strong>±5</strong> to the Speed stat directly.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Stacking & Reset</h4>
                <p>Same sign doesn't stack (Attack▲ + Attack▲ stays Attack▲); opposite signs cancel 1-for-1. Stages reset when the Pokémon switches out or the battle ends. Use the Reset button to clear all stages at once.</p>
            </>
        )
    },
    'save-slots': {
        title: 'Save & Export',
        body: () => (
            <>
                <p>PTA3 Dex offers two ways to preserve your data:</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Save Slots (browser snapshots)</h4>
                <p>Three named slots stored in your browser. Fast to create and restore — ideal for <strong>mid-session checkpoints</strong>. Note: these are browser-only and will be lost if you clear site data.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Export JSON (portable file)</h4>
                <p>Downloads a <code>.json</code> file to your device. Use this for <strong>backups</strong>, sharing with others, or moving your data to a different browser or device. Import it back via the menu.</p>
                <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Tip: The app auto-saves to localStorage every minute. Use both slots and exports for peace of mind.</p>
            </>
        )
    },
    'trainer-features': {
        title: 'Trainer Features',
        body: () => (
            <>
                <p>Features are special abilities granted automatically when your class level advances. There are no feat points — features are simply unlocked at each class level milestone.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Auto-Granted Features</h4>
                <p>Every time your trainer levels up, each class also advances one level and automatically grants any features tied to that class level. You don't need to pick or buy them.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Feature Drop</h4>
                <p>When a new feature is granted, you may optionally <strong>drop</strong> it in exchange for <strong>+1 to any stat</strong>. You can do this up to <strong>4 times</strong> total across your career. If you keep all features, the prompt disappears.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Level 15 Capstone</h4>
                <p>Only your <strong>first base class</strong> ever grants its Level 15 capstone feature. All other classes (advanced or secondary base) do not receive a Level 15 feature.</p>
            </>
        )
    },
    'trainer-skills': {
        title: 'Trainer Skills',
        body: () => (
            <>
                <p>There are <strong>18 skills</strong>, each linked to one of the 5 trainer stats. Skill checks are <strong>1d20 + ⌊stat ÷ 2⌋ + talent bonus</strong>.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Talent Bonus</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>0 talents:</strong> no bonus</li>
                    <li><strong>1 talent:</strong> +2</li>
                    <li><strong>2 talents:</strong> +5</li>
                </ul>
                <p>Click a skill to cycle talents (0 → 1 → 2 → 0). <strong>Concentration</strong> and <strong>Constitution</strong> are passive — they are invoked by the GM, not rolled manually. Max 2 talents per skill.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Gaining Talents</h4>
                <p>Talents come from your class skill pools. Each class grants access to a set of skills; choosing a class lets you apply talents to those skills.</p>
            </>
        )
    },
    'pokemon-stats': {
        title: 'Pokémon Stats',
        body: () => (
            <>
                <p>Pokémon have <strong>6 stats</strong> (HP, ATK, DEF, SATK, SDEF, SPD). All stats are <strong>fixed by the species</strong> Pokédex entry — there are no level-up stat points to allocate.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Nature Modifier</h4>
                <p>A Pokémon's nature raises one stat by <strong>+1</strong> and lowers another by <strong>−1</strong>. The five neutral natures (Hardy, Docile, Serious, Bashful, Quirky) have no effect.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>HP</h4>
                <p>Max HP is the species HP stat after the nature modifier. It does <em>not</em> scale with level.</p>
            </>
        )
    },
    'pokemon-skills': {
        title: 'Pokémon Capabilities',
        body: () => (
            <>
                <p>Pokémon <strong>capabilities</strong> are named traits that describe what a Pokémon can do outside of battle. They are fixed by species and cannot be changed.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Examples</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Sprouter</strong> — can grow plants through cracks in surfaces</li>
                    <li><strong>Sinker</strong> — can sink to the bottom of bodies of water</li>
                    <li><strong>Firestarter</strong> — can ignite flammable materials at will</li>
                    <li><strong>Threaded</strong> — can weave or spin thread-like substances</li>
                </ul>
                <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Speed (in feet per round) is listed separately on the species entry.</p>
            </>
        )
    },
    'honors': {
        title: 'Honors & Leveling',
        body: () => (
            <>
                <p><strong>Honors</strong> represent your trainer's reputation and accomplishments. They determine when you can level up — <em>they are not the same as Badges</em>.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Sources of Honors</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Gym Badges</strong> — each badge typically earns 1 Honor</li>
                    <li><strong>Contest Ribbons</strong> — each ribbon typically earns 1 Honor</li>
                    <li><strong>Story Milestones</strong> — GM-awarded at major events</li>
                </ul>
                <p>Badges are tracked separately as trophies. Earning a badge does <em>not</em> automatically add an Honor — the GM awards them explicitly.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Leveling Up</h4>
                <p>Once you have enough Honors for the next level, click the <strong>+</strong> button next to your level. Leveling up does <em>not</em> happen automatically when you earn honors.</p>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li>Levels 1–2: free (character creation)</li>
                    <li>Each level beyond that requires a set number of Honors</li>
                    <li>Maximum trainer level: <strong>15</strong></li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Class Slots</h4>
                <p>New class slots unlock at levels <strong>3, 7, and 11</strong>. At level 11, you may take a second Base class instead of an Advanced class (grants 1 talent, no Level 15 feature).</p>
            </>
        )
    },
    'z-moves': {
        title: 'Z-Moves',
        body: () => (
            <>
                <p>Z-Moves are powerful once-per-battle attacks that require a <strong>Z-Crystal</strong> matching the move's type. The Pokémon must be holding the crystal and know at least one move of that type.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Mechanics</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li>Deal <strong>8d12</strong> base damage (10d12 for certain species-specific Z-Moves)</li>
                    <li>Can only be used <strong>once per battle</strong> — the button greys out after use</li>
                    <li>Replaces the triggering move for that action</li>
                    <li>Automatically hits — no accuracy roll</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Species-Specific Z-Moves</h4>
                <p>Certain species (Pikachu, Snorlax, Decidueye, etc.) have unique Z-Moves that appear as a separate section in the Z-Move panel. These often have different ranges or special effects in addition to damage.</p>
            </>
        )
    },
    'dynamax': {
        title: 'Dynamax & Gigantamax',
        body: () => (
            <>
                <p>Dynamax requires a <strong>Power Spot</strong> (Gym, den, or similar) and Pokémon loyalty ≥2. Gigantamax additionally requires loyalty ≥3 and the species to be Gigantamax-capable.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Dynamax Effects</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>HP ×5</strong> — HP scales up on activation and clamps back on revert</li>
                    <li><strong>Movement</strong> reduced to 10ft per turn</li>
                    <li>All moves become <strong>Max Moves</strong> (80ft range, 30ft blast, 4d12, secondary terrain/stat effect)</li>
                    <li>Duration: <strong>1 minute</strong> (≈10 rounds); reverts automatically</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Gigantamax</h4>
                <p>Replaces the generic Max Move for that type with a species-specific <strong>G-Max Move</strong> (unique damage and effect). The G-Max roll button is one-use per Dynamax session.</p>
            </>
        )
    },
    'terastallization': {
        title: 'Terastallization',
        body: () => (
            <>
                <p>Terastallization replaces a Pokémon's typing with its <strong>Tera Type</strong> for the duration of the battle. Set the Tera Type on the Pokémon card before battle.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Effects While Terastallized</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li>Type changes to Tera Type — type matchups recalculate accordingly</li>
                    <li><strong>DEF +3</strong> and <strong>SDEF +3</strong> (shown as combat stage bonuses)</li>
                    <li><strong>Tera Aura</strong>: all Tera-type moves used nearby get STAB</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Tera Crown</h4>
                <p>While Terastallized, the Pokémon gains a special skill and an <strong>At-Will move</strong> tied to its Tera Type (e.g., Fire Tera Crown grants <em>Firestarter</em> + <em>Emberish</em>).</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Tera Blast</h4>
                <p>A Tera-type Ranged (40ft) attack dealing <strong>3d12</strong> damage using the higher of ATK or SATK. Usable <strong>3 times per battle</strong>.</p>
            </>
        )
    },
    'equipment': {
        title: 'Trainer Equipment',
        body: () => (
            <>
                <p>Trainers can equip items from their inventory. Equipped items are tracked here and their effects apply automatically.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Item Types</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Armor</strong> — grants a passive DEF or SDEF bonus while equipped (e.g. Chainmail: DEF +1, Full Plate: DEF +2)</li>
                    <li><strong>Weapons</strong> — used in the Dice Roller → Trainer → Weapon Attack mode for melee combat</li>
                    <li><strong>Clothing &amp; Accessories</strong> — provide a <strong>once-per-day</strong> bonus to a skill check; use "Mark used" to track it and Reset at the start of a new day</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Equipping Items</h4>
                <p>Go to the <strong>Inventory tab</strong> and click <em>Equip ↑</em> next to any armor, weapon, or clothing item. You can also equip directly from the quick-equip dropdown at the bottom of this panel.</p>
                <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Tip: Click any item name to view its full description and effects.</p>
            </>
        )
    },
    'hp-tracking': {
        title: 'HP Tracking',
        body: () => (
            <>
                <p>The HP tracker lets you apply damage and healing during battle without leaving the app.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Quick Buttons</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>−10 / −5 / −1</strong> — apply that much damage (red buttons)</li>
                    <li><strong>Full</strong> — instantly restore to Max HP (blue button)</li>
                    <li><strong>+1 / +5 / +10</strong> — heal that many HP (green buttons)</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Custom Amount</h4>
                <p>Type any number in the input box and click <strong>Dmg</strong> or <strong>Heal</strong> to apply an exact amount. Pressing <kbd>Enter</kbd> applies damage.</p>
                <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>HP is shown as a colour-coded bar: green above 50 %, orange above 25 %, red at 25 % or below.</p>
            </>
        )
    },
    'inventory': {
        title: 'Inventory',
        body: () => (
            <>
                <p>The Inventory tab tracks every item your trainer owns — Poké Balls, medicine, stat boosters, berries, armor, weapons, and clothing.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Using Items</h4>
                <p>Click an item to apply its effect to a Pokémon (healing, curing a status) or your trainer. Quantity is tracked automatically and decreases by one per use.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Stat Items</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Permanent</strong> (HP Up, Protein, etc.) — raise a stat immediately with no cap.</li>
                    <li><strong>Temporary</strong> (X Attack, Lansat Berry, etc.) — apply a battle-only bonus capped per item; stacks reset after battle.</li>
                </ul>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Equip vs. Use</h4>
                <p>Armor, weapons, clothing, and accessories are <strong>equipped</strong> rather than consumed — see the Equipment help topic on the Trainer tab.</p>
                <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Tip: use the search box and type filter to find an item quickly among the full catalog.</p>
            </>
        )
    },
    'gm-capture': {
        title: 'Capture Rate Calculator',
        body: () => (
            <>
                <p>Simulates a capture attempt: roll <strong>d100</strong>, and the catch succeeds if the roll is <em>strictly less than</em> the target number (ties fail).</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Target Number</h4>
                <p>Target = base rate (by species rarity &amp; evolution stage) + HP modifier + status modifier + initiative modifier + Poké Ball modifier.</p>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li>Base rates drop as rarity increases and as the species evolves further.</li>
                    <li>A wounded target is easier to catch; a Pokémon at full HP is harder.</li>
                    <li><strong>Master Ball</strong> always succeeds — no roll needed.</li>
                </ul>
            </>
        )
    },
    'gm-encounter': {
        title: 'Encounter Guide',
        body: () => (
            <>
                <p>Reference tools for running wild encounters.</p>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Encounter Difficulty</strong> — party-size guidance for Easy/Normal/Hard/Dangerous wild fights.</li>
                    <li><strong>Wild Filler Behavior (d20)</strong> — how nearby wild Pokémon react when a battle breaks out.</li>
                    <li><strong>Wild Nature Roller</strong> — randomly rolls one of the 25 natures for a new wild Pokémon.</li>
                    <li><strong>Special Encounter Forms</strong> — Alpha, Totem, Titan, Shadow, and Purified variant stats and capture notes.</li>
                    <li><strong>Other Ways to Vary Your Wild Pokémon</strong> — lighter touches (held items, Shiny, size, unique passives/moves) short of a full Special Form.</li>
                    <li><strong>Skill Check DC Scale</strong> — quick DC reference for d20 + talent bonus (+0/+2/+5) checks.</li>
                </ul>
            </>
        )
    },
    'gm-rewards': {
        title: 'Rewards & Loot',
        body: () => (
            <>
                <p>Payout references for downtime and battle rewards.</p>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Wild Goods Finder (d100)</strong> — roll to see what a trainer finds foraging in the wild.</li>
                    <li><strong>Pokécredit Reward Tables</strong> — suggested payouts for league battles, gym battles, tournaments, contests, and odd jobs.</li>
                    <li><strong>Loyalty Progression</strong> — downtime hours for Loyalty 0→3; a different, non-hours mechanic (checklist, then pure GM judgment) governs 3→4 and 4→5.</li>
                </ul>
            </>
        )
    },
    'gm-gym': {
        title: 'Gym Guide',
        body: () => (
            <>
                <p>Scaling and passives for Gym Leaders and the Elite Four.</p>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Badge Count Scaling</strong> — how many Pokémon and how much complexity to give a Gym Leader based on the party's current badge count.</li>
                    <li><strong>Gym Pokémon Passives</strong> — stat and ability passives assignable to Gym Leader/Trainer Pokémon.</li>
                    <li><strong>Gym Trainer Features</strong> — once-per-day abilities a Gym Leader or their gym trainers can use.</li>
                    <li><strong>Elite Four Passives</strong> — stronger versions of the gym passives for Elite Four members' Pokémon.</li>
                    <li><strong>Elite Four Trainer Features</strong> — once-per-day abilities for the Elite Four members themselves.</li>
                </ul>
                <p>Tag an NPC's team Pokémon or the NPC trainer itself with any of these from <strong>NPC Roster</strong> — see its help for details.</p>
            </>
        )
    },
    'gm-npc': {
        title: 'NPC Stats',
        body: () => (
            <>
                <p>Generates ready-to-use stat blocks for NPC trainers.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Tiers</h4>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Junior</strong> — a new trainer.</li>
                    <li><strong>Experienced</strong> — a seasoned trainer.</li>
                    <li><strong>Veteran</strong> — an expert trainer.</li>
                </ul>
                <p>Pick a tier, trainer class, and level to see that NPC's 5 stats and any class features they've unlocked. Like player trainers, NPCs are 20 HP base +1d4 rolled at levels 3/7/11 — if the level you pick has passed one of those milestones, the actual roll happens after you save (NPC Roster shows a <strong>🎲 Roll HP</strong> button). Use <strong>Copy</strong> to paste the stat block straight into your notes, or <strong>Save as NPC</strong> to keep it in your NPC Roster.</p>
            </>
        )
    },
    'gm-npcroster': {
        title: 'NPC Roster',
        body: () => (
            <>
                <p>Persistent library of NPCs — their stats, features, and Pokémon team — so you don't have to rebuild a recurring rival or gym trainer every session.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Building an NPC</h4>
                <p>Generate a stat block in <strong>NPC Stats</strong> and hit <strong>Save as NPC</strong> as a quick template, or start from <strong>+ New Blank NPC</strong> here and set the 5 stats by hand. Either way, the class dropdown next to the name is always editable — pick any of the 7 base or 35 advanced classes (or "No class" for a level-0 NPC with no features) to build things like a Gym Leader or Elite Four member the generator's 3 tiers don't cover.</p>
                <p>If the NPC's level has passed 3, 7, or 11, a <strong>🎲 Roll HP</strong> button appears — click it to roll the 1d4 HP bonus for that milestone (same rule as player trainers). Editing the level down trims off rolls that no longer apply.</p>
                <p><strong>+ Feature</strong> tags the NPC trainer itself with one of the Gym/Elite Four <em>trainer</em> features from the <strong>Gym Guide</strong> tab (e.g. "I'll Show You Our True Power!", "Elite Intimidation") — these are the book's trainer-facing abilities, separate from the Pokémon passives below.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Team</h4>
                <p>Use <strong>+ Add Pokémon</strong> to search the Pokédex — stats, types, and moves fill in automatically, same as a player's Pokémon. Track HP with the +/− stepper on each entry.</p>
                <p>Each team Pokémon can be tagged with <strong>+ Passive</strong> — the Gym/Elite Four passives from the <strong>Gym Guide</strong> tab (Gym Anchor, Elite's, Elite Striker, etc.), for a Gym Leader or Elite Four member's team. Per HB1's Pokémon Passives rule, a Pokémon can't carry more than 3 Stat Passives at once (Ability Passives are unlimited) — the picker enforces that cap for passives added here, though it can't see stat passives a species already has from the Pokédex, so account for those yourself.</p>
                <p>NPCs are saved with the rest of your data — they're included in exports, imports, and save slots.</p>
            </>
        )
    },
    'gm-initiative': {
        title: 'Initiative Tracker',
        body: () => (
            <>
                <p>Turn-order tracker for combat. Add combatants from three sources: your <strong>NPC Roster</strong> (NPC alone, or NPC + its whole team), <strong>Players</strong> (a trainer and any of their active party Pokémon), or a <strong>Custom</strong> one-off entry for something improvised.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Turn order</h4>
                <p>By the book (PHB1 Rules of Engagement), turn order is just raw Speed, highest first — no roll needed, and that's the default here. Ties are broken by an opposed Speed check between the tied combatants.</p>
                <p>If your table prefers the "Roll For Initiative" variant instead, 🎲 rolls 1d20 + Speed for a single combatant (or use <strong>Roll All</strong> for everyone still unrolled); <strong>Clear Rolls</strong> reverts back to plain Speed order. <strong>Next Turn</strong> advances the highlighted combatant and bumps the round counter once it wraps around.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Quick Check (🎯)</h4>
                <p>Why: combat throws up rolls the book doesn't give you a dedicated tool for — an opposed check, a reaction, a GM ruling on the fly — and switching to the Dice Roller mid-fight just to make one roll is friction. 🎯 Check on any row rolls <strong>1d20 + a modifier</strong> right there instead.</p>
                <p>How: pick <strong>Stat</strong> to auto-use ⌊stat/2⌋ — the same math the book uses when a GM secretly rolls an NPC's stat against a target's (see the HB1 combat demo) — or <strong>Flat</strong> to type your own modifier, e.g. a trained skill's talent bonus the tracker doesn't know about. Fill in an opposing target number to get an automatic Success/Fail, or leave it blank and just read the total.</p>
                <p>This is deliberately lightweight — it doesn't know move damage, STAB, or combat stages, since combatant entries here only keep move names, not full move data. For an actual attack roll, use the <strong>Dice Roller</strong> (Battle tab), which now also rolls for NPCs and their teams via its Player Trainer / NPC toggle.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Scratchpad, not source of truth</h4>
                <p>Combatants are a snapshot taken when added — HP changes here don't write back to your trainers, Pokémon, or NPC Roster. Apply any lasting damage there separately. The tracker survives a page refresh but isn't part of exports or save slots. The same goes for the Quick Check log — it's session-only and clears on refresh.</p>
            </>
        )
    },
    'gm-contest': {
        title: 'Contest Tracker',
        body: () => (
            <>
                <p>Runs a Pokémon Contest from setup through judging. Add a 5th contestant if you want — the GMG says contests normally run four or five.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Heart Points</h4>
                <p>Each of the 3 judges scores every contestant; use the grid to track running totals per judge.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Star Points</h4>
                <p>Award a Star Point to whichever contestant leads a judge's column, using total Heart Points as the tiebreaker. Per the GMG, it's fine — and the norm — for a Star Point (and even first place) to go to multiple still-tied contestants.</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>NPC Roll</h4>
                <p>Roll d20 to determine an NPC competitor's contest preparedness (Novice / Prepared / Expert Coordinator).</p>
                <h4 style={{ margin: '14px 0 6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Additional Judges</h4>
                <p>A separate d20 roll for when players join a contest suddenly — decides the makeup of the 2 (or 3) judges beyond the main host judge.</p>
            </>
        )
    },
    'reference': {
        title: 'Quick Reference',
        body: () => (
            <>
                <p>A searchable database for everything you'd otherwise need to flip through the handbooks for.</p>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Pokédex</strong> — every species' stats, capabilities, moves, and abilities.</li>
                    <li><strong>Type Chart</strong> — full type effectiveness grid.</li>
                    <li><strong>Natures</strong> — all 25 natures and their ±1 stat modifiers.</li>
                    <li><strong>Moves Database</strong> — every move's type, range, frequency, and damage.</li>
                    <li><strong>Abilities</strong> — ability descriptions.</li>
                    <li><strong>Game Rules</strong> — condensed core rules text.</li>
                    <li><strong>Honor Thresholds</strong> — Honors required per trainer level.</li>
                </ul>
            </>
        )
    },
    'notes': {
        title: 'Campaign Notes',
        body: () => (
            <>
                <p>A place to keep track of the story as it unfolds, separate from any single trainer's mechanical sheet.</p>
                <ul style={{ paddingLeft: '18px', margin: '0 0 10px', lineHeight: '1.8' }}>
                    <li><strong>Campaign</strong> — freeform long-term notes (NPCs, plot threads, world details).</li>
                    <li><strong>Session</strong> — freeform notes for the current session.</li>
                    <li><strong>Quests</strong> — a quest log with Active / Completed / Abandoned status per entry.</li>
                </ul>
                <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>Both note fields save automatically as you type.</p>
            </>
        )
    },
};

const HelpModal = () => {
    const { helpTopic, closeHelp } = useUI();
    const { modalRef } = useModalKeyboard(!!helpTopic, closeHelp);

    if (!helpTopic) return null;

    const content = HELP_CONTENT[helpTopic];
    if (!content) return null;

    const Body = content.body;

    return (
        <div className="modal-overlay" onClick={closeHelp} role="presentation">
            <div
                ref={modalRef}
                className="modal"
                style={{ maxWidth: 'min(95vw, 480px)' }}
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="help-modal-title"
            >
                <div
                    className="modal-header"
                    style={{
                        background: 'linear-gradient(135deg, #f5a623, #e8941c)',
                        color: 'white',
                        margin: '-25px -25px 20px -25px',
                        padding: '18px 20px',
                        borderRadius: '17px 17px 0 0',
                        borderBottom: 'none'
                    }}
                >
                    <h3
                        id="help-modal-title"
                        style={{ margin: 0, fontSize: '18px', fontWeight: '800', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                    >
                        {content.title}
                    </h3>
                    <button
                        onClick={closeHelp}
                        aria-label="Close help"
                        title="Close"
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            border: '2px solid rgba(255,255,255,0.3)',
                            fontSize: '18px',
                            cursor: 'pointer',
                            color: 'white',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            fontWeight: 'bold',
                            flexShrink: 0
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.35)';
                            e.currentTarget.style.transform = 'rotate(90deg)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                            e.currentTarget.style.transform = 'rotate(0deg)';
                        }}
                    >
                        ×
                    </button>
                </div>

                <div style={{ padding: '0 25px 25px', fontSize: '14px', lineHeight: '1.6', color: 'var(--text-color)' }}>
                    <Body />
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
