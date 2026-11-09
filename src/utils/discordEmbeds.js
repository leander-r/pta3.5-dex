// ============================================================
// Discord Embed Builders
// ============================================================
// Shared logic for building rich Discord embeds from roll data.

// Pokémon-game-style coloured HP bar using Discord's ANSI code block support.
// Green ≥ 66 %  |  Orange ≥ 33 %  |  Red > 0 %  |  Empty at 0 %
const ANSI_RESET  = '\u001b[0m';
const hpBar = (current, max, blocks = 10) => {
    const pct    = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
    const filled = Math.round(pct * blocks);
    const color  = pct > 0.66 ? '\u001b[1;32m'   // bright green
                 : pct > 0.33 ? '\u001b[0;33m'   // yellow-orange
                 : pct > 0    ? '\u001b[1;31m'   // bright red
                 :              '';               // no color at 0 HP
    const reset  = color ? ANSI_RESET : '';
    return `${color}${'█'.repeat(filled)}${reset}${'░'.repeat(blocks - filled)}`;
};

// Wraps an hpBar + "current/max" label in a Discord ANSI code block.
const hpFieldValue = (current, max) =>
    `\`\`\`ansi\n${hpBar(current, max)} ${current}/${max}\n\`\`\``;

const STATUS_EMOJI = {
    burned: '🔥', frozen: '🧊', paralyzed: '⚡', poisoned: '☠️', toxified: '🧪',
    asleep: '💤', confused: '💫', infatuated: '💕', cursed: '💀', stunned: '😵‍💫', fainted: '✖️',
};

export const buildPokemonEmbed = (roll, trainerName) => {
    const hit  = roll.isHit;
    const crit = roll.isCrit;
    const miss = !hit;

    const icon   = miss ? '❌' : crit ? '💥' : roll.isStatus ? '✨' : '⚔️';
    const suffix = crit ? ' — CRITICAL HIT!' : '';
    const title  = `${icon} ${roll.pokemon} used ${roll.move}!${suffix}`;
    const color  = miss ? 0x95A5A6 : crit ? 0xFF6F00 : (roll.typeColor || 0xF5A623);

    // One-line battle summary as description
    const acOverride = roll.acWasOverridden ? ' *(DM)*' : '';
    const modStr = roll.accModifier !== 0
        ? ` ${roll.accModifier > 0 ? '+' : ''}${roll.accModifier} = ${roll.modifiedAccRoll}`
        : '';
    const typeStr = `${roll.moveType} · ${roll.category}`;

    const critLabel = roll.critThreshold && roll.critThreshold < 20
        ? `Natural ${roll.accRoll}! (Crit on ${roll.critThreshold}–20)`
        : `Natural ${roll.accRoll}!`;

    let description;
    if (crit) {
        const dmgStr = roll.total ? ` · **${roll.total} damage**` : '';
        description = `🎯 ${critLabel} vs AC ${roll.moveAC}${acOverride} · ${typeStr}${dmgStr}`;
    } else if (roll.isStatus) {
        description = `${hit ? '✅ Hit' : '✗ Miss'} · Roll ${roll.accRoll}${modStr} vs AC ${roll.moveAC}${acOverride} · ${typeStr} · ${hit ? 'Effect applies!' : 'No effect'}`;
    } else if (miss) {
        description = `✗ Miss · Roll ${roll.accRoll}${modStr} vs AC ${roll.moveAC}${acOverride} · ${typeStr}`;
    } else {
        const dmgStr = roll.total ? ` · **${roll.total} damage**` : '';
        description = `✅ Hit · Roll ${roll.accRoll}${modStr} vs AC ${roll.moveAC}${acOverride} · ${typeStr}${dmgStr}`;
    }

    const fields = [];

    // Damage breakdown (any hit that rolled dice, including status-category moves with damage)
    if (hit && roll.dice) {
        const diceBonus = roll.diceBonus ?? 0;
        const parts = [`[${roll.rolls.join(', ')}] = ${roll.diceTotal}`];
        if (diceBonus)      parts.push(`${diceBonus} (base)`);
        if (roll.statBonus) parts.push(`${roll.statBonus} (stat)`);
        if (roll.stabBonus) parts.push(`${roll.stabBonus} (STAB)`);
        const formula = parts.join(' + ');
        const notation = diceBonus ? `${roll.dice}+${diceBonus}` : roll.dice;
        fields.push({
            name: crit ? '🎲 Damage (Crit — max dice value)' : '🎲 Damage',
            value: `${notation}: ${formula} = **${roll.total}**`,
            inline: false,
        });
    }

    // Effect field for status-category moves that also deal damage
    if (hit && roll.category === 'Status' && roll.dice) {
        fields.push({ name: '✨ Effect', value: 'Applies!', inline: true });
    }

    // Active combat stages relevant to this roll (non-zero only)
    if (roll.relevantStages?.length > 0) {
        const ordinal = n => {
            const i = Number(n); // guard against string values from old history entries
            const s = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
            return `${i}${s}`;
        };
        const stageStr = roll.relevantStages.filter(s => s.stage != null && s.stage !== 0).map(({ label, stage, bonus, base, boosted, isFlat, isDice, diceDelta }) => {
            const stageNum  = Number(stage);
            const abs       = Math.abs(stageNum);
            const sign      = stageNum >= 0 ? '+' : '−';
            if (isFlat) {
                const bonusSign = bonus >= 0 ? '+' : '−';
                const bonusAbs  = Math.abs(bonus);
                return `**${label}** ${sign}${ordinal(abs)} Combat Stage = ${bonusSign}${bonusAbs} to roll`;
            }
            if (isDice) {
                const deltaSign = diceDelta >= 0 ? '+' : '−';
                const deltaAbs  = Math.abs(diceDelta);
                return `**${label}** ${sign}${ordinal(abs)} Combat Stage = ${deltaSign}${deltaAbs} damage ${deltaAbs === 1 ? 'die' : 'dice'}`;
            }
            const bonusSign = bonus >= 0 ? '+' : '−';
            const bonusAbs  = Math.abs(bonus);
            return `**${label}** ${sign}${ordinal(abs)} Combat Stage = ${base} ${bonusSign} ${bonusAbs} = **${boosted}**`;
        }).join('\n');
        fields.push({ name: '📊 Combat Stages', value: stageStr, inline: false });
    }

    // Attacker HP bar
    if (roll.attackerMaxHP > 0) {
        fields.push({
            name: `${roll.pokemon} HP`,
            value: hpFieldValue(roll.attackerCurrentHP, roll.attackerMaxHP),
            inline: false,
        });
    }

    // Status conditions
    if (roll.activeStatuses?.length > 0) {
        fields.push({
            name: 'Status',
            value: roll.activeStatuses.map(s => `${STATUS_EMOJI[s] || '•'} ${s}`).join('  '),
            inline: true,
        });
    }

    // Mega form
    if (roll.megaEvolved && roll.megaFormName) {
        fields.push({ name: 'Mega', value: roll.megaFormName, inline: true });
    }

    const embed = {
        author: { name: trainerName },
        title,
        description,
        color,
        fields,
        timestamp: new Date().toISOString(),
    };

    if (roll.pokemonSpriteUrl) {
        embed.thumbnail = { url: roll.pokemonSpriteUrl };
    }

    return embed;
};

export const buildTrainerSkillEmbed = (roll, trainerName) => {
    const modStr     = `${roll.modifier >= 0 ? '+' : ''}${roll.modifier} ${roll.skillStat}`;
    const trainedStr = roll.hasSkill ? ` · +${roll.bonus} trained` : '';
    const description = `**Total: ${roll.total}** · [${roll.rolls.join(', ')}] ${modStr}${trainedStr}`;

    const fields = [];
    if (roll.trainerMaxHP > 0) {
        fields.push({
            name: 'Trainer HP',
            value: hpFieldValue(roll.trainerCurrentHP, roll.trainerMaxHP),
            inline: false,
        });
    }

    return {
        author: { name: trainerName },
        title: `📚 ${roll.skill} Check`,
        description,
        color: 0x667EEA,
        fields,
        timestamp: new Date().toISOString(),
    };
};

export const buildTrainerAttackEmbed = (roll, trainerName) => {
    const hit  = roll.isHit;
    const crit = roll.isCrit;

    const icon  = !hit ? '❌' : crit ? '💥' : '🥊';
    const suffix = crit ? ' — CRITICAL HIT!' : '';
    const label = roll.weaponName ? `${roll.moveName} (${roll.weaponName})` : (roll.moveName || 'Unarmed Strike');
    const title = `${icon} ${trainerName || 'Trainer'} used ${label}!${suffix}`;
    const color = !hit ? 0x95A5A6 : crit ? 0xFF6F00 : 0xF5A623;

    const acTarget = roll.moveAC != null ? `vs AC ${roll.moveAC}` : '(no target set)';
    const modStr = roll.accModifier
        ? ` ${roll.accModifier > 0 ? '+' : ''}${roll.accModifier} = ${roll.modifiedAccRoll}`
        : '';
    const description = hit
        ? `✅ Hit · Roll ${roll.accRoll}${modStr} ${acTarget}${roll.total ? ` · **${roll.total} damage**` : ''}`
        : `✗ Miss · Roll ${roll.accRoll}${modStr} ${acTarget}`;

    const fields = [];
    if (hit && roll.dice) {
        const parts = [`[${(roll.rolls || []).join(', ')}] = ${roll.diceTotal}`];
        if (roll.atkMod) parts.push(`${roll.atkMod} (ATK)`);
        fields.push({
            name: crit ? '🎲 Damage (Crit — max dice value)' : '🎲 Damage',
            value: `${roll.dice}: ${parts.join(' + ')} = **${roll.total}**`,
            inline: false,
        });
    }

    return {
        author: { name: trainerName },
        title,
        description,
        color,
        fields,
        timestamp: new Date().toISOString(),
    };
};

export const buildHealEmbed = (roll, trainerName) => {
    let description = `**+${roll.amount} HP** healed`;
    if (roll.rolls?.length > 0) {
        const bonusPart = roll.bonus > 0 ? ` + ${roll.bonus}` : '';
        description += ` · ${roll.formula}: [${roll.rolls.join(', ')}]${bonusPart} = ${roll.amount}`;
    } else if (roll.formula) {
        description += ` · ${roll.formula}`;
    }

    const fields = [];
    if (roll.hpMax > 0) {
        const barBefore = hpBar(roll.hpBefore ?? roll.hpAfter, roll.hpMax);
        const barAfter  = hpBar(roll.hpAfter  ?? roll.hpBefore, roll.hpMax);
        const fullMark  = roll.hpAfter >= roll.hpMax ? ' ✨ Full!' : '';
        fields.push({
            name: `${roll.pokemon} HP`,
            value: `\`\`\`ansi\nBefore ${barBefore} ${roll.hpBefore}/${roll.hpMax}\nAfter  ${barAfter} ${roll.hpAfter}/${roll.hpMax}${fullMark}\n\`\`\``,
            inline: false,
        });
    }

    const embed = {
        author: { name: trainerName },
        title: `🩹 ${roll.pokemon} used ${roll.item}`,
        description,
        color: 0x4CAF50,
        fields,
        timestamp: new Date().toISOString(),
    };

    if (roll.pokemonSpriteUrl) {
        embed.thumbnail = { url: roll.pokemonSpriteUrl };
    }

    return embed;
};

export const buildCustomEmbed = (roll, trainerName) => {
    const bonusStr = roll.bonus ? ` + ${roll.bonus}` : '';
    return {
        author: { name: trainerName },
        title: `🎲 Custom Roll: ${roll.dice}`,
        description: `[${roll.rolls.join(', ')}]${bonusStr} = **${roll.total}**`,
        color: 0x95A5A6,
        timestamp: new Date().toISOString(),
    };
};

export const buildPokemonSkillEmbed = (roll, trainerName) => {
    const modStr = `+${roll.modifier} ${roll.skillStat}`;
    const description = `**Total: ${roll.total}** · [${roll.rolls.join(', ')}] ${modStr}`;
    const fields = [];
    if (roll.pokemonMaxHP > 0) {
        fields.push({
            name: `${roll.pokemon} HP`,
            value: hpFieldValue(roll.pokemonCurrentHP, roll.pokemonMaxHP),
            inline: false,
        });
    }
    return {
        author: { name: trainerName },
        title: `🎯 ${roll.pokemon} — ${roll.skill} Check`,
        description,
        color: 0x26A69A,
        fields,
        timestamp: new Date().toISOString(),
    };
};

// GM Tools → Initiative Tracker "Quick Check": a generic 1d20 + stat/flat modifier
// roll for whichever combatant is up, with an optional opposing target number.
export const buildQuickCheckEmbed = (roll, actorName) => {
    const modStr = `${roll.mod >= 0 ? '+' : ''}${roll.mod}`;
    let description = `**Total: ${roll.total}** · [${roll.d20}] ${modStr} (${roll.label})`;
    if (roll.target != null) {
        description += ` vs ${roll.target} → ${roll.success ? '✅ Success' : '❌ Fail'}`;
    }
    return {
        author: { name: actorName },
        title: `🎯 ${roll.combatantName} — Quick Check`,
        description,
        color: roll.success === false ? 0xF44336 : roll.success === true ? 0x4CAF50 : 0x667EEA,
        timestamp: new Date().toISOString(),
    };
};

export const buildEmbed = (roll, trainerName) => {
    if (roll.type === 'pokemon')        return buildPokemonEmbed(roll, trainerName);
    if (roll.type === 'trainer_skill')  return buildTrainerSkillEmbed(roll, trainerName);
    if (roll.type === 'trainer_attack') return buildTrainerAttackEmbed(roll, trainerName);
    if (roll.type === 'pokemon_skill') return buildPokemonSkillEmbed(roll, trainerName);
    if (roll.type === 'heal')          return buildHealEmbed(roll, trainerName);
    if (roll.type === 'custom')        return buildCustomEmbed(roll, trainerName);
    if (roll.type === 'quick_check')   return buildQuickCheckEmbed(roll, trainerName);
    return null;
};
