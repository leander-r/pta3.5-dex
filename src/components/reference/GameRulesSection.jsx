// ============================================================
// Game Rules Section Component (PTA3.5)
// ============================================================

import React, { useState } from 'react';

const GameRulesSection = () => {
    const [expandedSection, setExpandedSection] = useState('combat');

    const sections = [
        {
            id: 'combat',
            title: 'Combat Basics',
            content: (
                <div>
                    <h4>Accuracy Roll</h4>
                    <p>Roll 1d20 + stat modifier vs. the target's opposing stat value (not a fixed AC).</p>
                    <ul>
                        <li><strong>Attack move:</strong> 1d20 + ATK mod vs. target DEF value</li>
                        <li><strong>Special Attack move:</strong> 1d20 + SATK mod vs. target SDEF value</li>
                        <li><strong>Effect move:</strong> 1d20 + SATK mod vs. target SPD value</li>
                        <li><strong>Natural 20:</strong> All damage dice deal maximum (not ×2 rolls)</li>
                    </ul>

                    <h4>Turn Order</h4>
                    <ul>
                        <li>Highest SPD acts first; ties resolved by SPD value then coin flip</li>
                    </ul>

                    <h4>Actions Per Turn</h4>
                    <ul>
                        <li><strong>Standard Action:</strong> Use a move, item, or ability</li>
                        <li><strong>Shift Action:</strong> Move up to your Speed in feet</li>
                        <li><strong>Swift Action:</strong> Minor action (recall, activate trait, etc.)</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'damage',
            title: 'Damage & Type Effectiveness',
            content: (
                <div>
                    <h4>Damage Formula</h4>
                    <p><strong>Total = Dice + modifier + STAB + type bonus/penalty</strong></p>
                    <ul>
                        <li>Physical moves add ATK modifier (⌊ATK/2⌋)</li>
                        <li>Special moves add SATK modifier (⌊SATK/2⌋)</li>
                        <li><strong>STAB:</strong> +4 flat (same type attack bonus)</li>
                        <li><strong>Critical hit:</strong> All damage dice deal maximum value</li>
                    </ul>

                    <h4>Type Effectiveness (die count)</h4>
                    <ul>
                        <li><strong>Super Effective (×2):</strong> Roll +1 extra damage die</li>
                        <li><strong>Extremely Effective (×4):</strong> Roll +2 extra damage dice</li>
                        <li><strong>Resistant (×½):</strong> Roll −1 damage die (minimum 1)</li>
                        <li><strong>Highly Resistant (×¼):</strong> Roll −2 damage dice (minimum 1)</li>
                        <li><strong>Immune (×0):</strong> No damage</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'keywords',
            title: 'Move Keywords',
            content: (
                <div>
                    <p style={{ marginBottom: '10px' }}>Shorthand tags on moves for mechanics that are easier to reference once than spell out every time.</p>
                    <h4>Lethal <span style={{ fontWeight: 'normal', color: '#888' }}>(new in 3.5)</span></h4>
                    <p>Scores a Critical Hit on a natural <strong>19 or 20</strong> instead of just 20 — but only once per combat. If you roll a 19 again after already using the upgrade, you can choose not to count it as a crit.</p>
                    <h4>Latched <span style={{ fontWeight: 'normal', color: '#888' }}>(new in 3.5)</span></h4>
                    <p>A bite-based effect. Staying adjacent to the Pokémon that Latched you avoids a penalty on your next turn; moving away triggers one (usually an Affliction or extra harm). Ends automatically after the Latched creature acts.</p>
                    <h4>Stance <span style={{ fontWeight: 'normal', color: '#888' }}>(new in 3.5)</span></h4>
                    <p>Marks a move as granting a persistent passive-while-active state (e.g. heal each turn, punish melee attackers). Only one Stance can be active at a time — using another move with Stance, or a different Stance effect, replaces it.</p>
                    <h4>Priority</h4>
                    <p>Lets the user act first during the round. If multiple Pokémon use Priority moves the same round, whoever has higher Speed goes first among them.</p>
                    <h4>Reaction</h4>
                    <p>Can be used out of turn order on a specific trigger, including during another character's turn — but using one counts as that round's command, and interrupts the current turn until it resolves.</p>
                    <h4>Recharge</h4>
                    <p>The user can't move or act on the following round. They can still be recalled to a Poké Ball or have a medicine item used on them.</p>
                    <h4>Multi-Turn</h4>
                    <p>Takes more than one turn to complete. The user can't use other moves, declare Priority, or have medicine items used on them while it's in progress — but a trainer can still command other Pokémon on the intervening turns.</p>
                    <h4>Scatter</h4>
                    <p>Targets multiple Pokémon, or the same Pokémon multiple times, each with a separate Accuracy Check (Scatter 3 or Scatter 5). Type-effectiveness, Stat ▲/▼, and STAB only apply once per turn, not per hit.</p>
                    <h4>Coat</h4>
                    <p>A status effect placed onto a Pokémon that persists until they're recalled or leave combat for a minute. A newer Coat's effect overrides an older, conflicting one.</p>
                    <h4>Hazards</h4>
                    <p>Placed in an area of effect and affect anyone who enters; fade after about a minute outside combat.</p>
                </div>
            )
        },
        {
            id: 'hp',
            title: 'HP & Recovery',
            content: (
                <div>
                    <h4>Trainer HP</h4>
                    <ul>
                        <li>Base: <strong>20 HP</strong></li>
                        <li>+1d4 at levels <strong>3, 7, and 11</strong> (milestone rolls)</li>
                        <li>Example: Lv11 trainer with rolls of 3, 1, 4 → <strong>28 HP</strong></li>
                    </ul>

                    <h4>Pokémon HP</h4>
                    <ul>
                        <li>HP is a <strong>fixed species value</strong> from the Pokédex entry</li>
                        <li>Nature modifier applies: ±1 to the affected stat (including HP)</li>
                        <li>No level-based HP scaling</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'stats',
            title: 'Stats & Combat Stages',
            content: (
                <div>
                    <h4>Stat Modifier</h4>
                    <p><strong>modifier = ⌊stat / 2⌋</strong></p>
                    <ul>
                        <li>Stat 2 → mod +1 | Stat 4 → mod +2 | Stat 6 → mod +3</li>
                        <li>Stat 8 → mod +4 | Stat 10 → mod +5</li>
                    </ul>

                    <h4>Combat Stages</h4>
                    <p>ATK / DEF / SATK / SDEF stages don't touch the stat — each stage adds (▲) or removes (▼) <strong>1 damage die</strong> on the relevant attack instead. Speed is the exception: each stage is still a flat <strong>±5</strong> to the Speed stat.</p>
                    <ul>
                        <li>Example: a move rolling 3d8 with Attack▲ rolls 4d8 instead</li>
                        <li>Same sign doesn't stack (Attack▲ + Attack▲ stays Attack▲); opposite signs cancel 1-for-1</li>
                        <li>If stages remove every die a move has, it deals only its stat bonus + STAB (no dice)</li>
                        <li>ACC / EVA stages are pure modifiers added to/subtracted from rolls</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'trainer',
            title: 'Trainer Rules',
            content: (
                <div>
                    <h4>Character Creation</h4>
                    <ul>
                        <li>5 stats (ATK, DEF, SATK, SDEF, SPD) — no HP stat</li>
                        <li>Point-buy budget: <strong>30 points</strong></li>
                        <li>Cumulative cost to reach: 1=1pt | 2=2pt | 3=3pt | 4=6pt | 5=8pt | 6=11pt</li>
                        <li>Max stat at creation: <strong>6</strong> — can reach 10 via level-up (flat 1pt per +1)</li>
                    </ul>

                    <h4>Leveling (Honor-based)</h4>
                    <ul>
                        <li>Levels advance by earning <strong>Honors</strong> (Gym Badges, Ribbons, etc.)</li>
                        <li>Max level: <strong>15</strong></li>
                        <li>Stat increase (+1 to two different stats) only at levels <strong>3, 7, and 11</strong></li>
                        <li>Class slots: 1st at Lv1 | 2nd at Lv3 | 3rd at Lv7 | 4th at Lv11</li>
                        <li>HP milestone rolls (1d4) at levels <strong>3, 7, and 11</strong></li>
                    </ul>

                    <h4>Skill Checks</h4>
                    <ul>
                        <li>Roll: <strong>1d20 + ⌊stat/2⌋ + talent bonus</strong></li>
                        <li>0 talents: +0 | 1 talent: +2 | 2 talents: +5</li>
                        <li>18 skills across 5 stats; Concentration and Constitution are Passive</li>
                        <li>Check: roll vs. a DC set by GM | Opposed: roll vs. target's roll</li>
                    </ul>
                </div>
            )
        }
    ];

    return (
        <div>
            <h3>Game Rules Quick Reference (PTA3.5)</h3>
            <p style={{ marginBottom: '15px', fontSize: '13px', color: '#666' }}>
                Essential rules for Pokémon Tabletop Adventures 3.5.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sections.map(section => (
                    <div
                        key={section.id}
                        style={{ border: '1px solid #dee2e6', borderRadius: '8px', overflow: 'hidden' }}
                    >
                        <button
                            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                            style={{
                                width: '100%',
                                padding: '12px 15px',
                                background: expandedSection === section.id ? 'linear-gradient(135deg, #667eea, #764ba2)' : '#f8f9fa',
                                color: expandedSection === section.id ? 'white' : '#333',
                                border: 'none',
                                textAlign: 'left',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span>{section.title}</span>
                            <span>{expandedSection === section.id ? '−' : '+'}</span>
                        </button>

                        {expandedSection === section.id && (
                            <div
                                style={{ padding: '15px 20px', background: 'white', fontSize: '13px', lineHeight: '1.6' }}
                                className="game-rules-content"
                            >
                                {section.content}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GameRulesSection;
