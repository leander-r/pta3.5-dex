// ============================================================
// CombatStagesPanel Tests
// ============================================================
// Pure props-driven component — no context dependencies.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import CombatStagesPanel from '../CombatStagesPanel.jsx';

const basePokemon = { name: 'Pikachu', types: ['Electric'] };
const baseStats = { atk: 10, def: 8, satk: 12, sdef: 8, spd: 14 };

function renderPanel(overrides = {}) {
    const props = {
        selectedPokemon: basePokemon,
        combatStages: {},
        getStatsWithMega: () => baseStats,
        updateCombatStage: vi.fn(),
        resetCombatStages: vi.fn(),
        ...overrides,
    };
    const utils = render(<CombatStagesPanel {...props} />);
    return { ...utils, props };
}

describe('CombatStagesPanel', () => {
    it('renders nothing when no Pokemon is selected', () => {
        const { container } = renderPanel({ selectedPokemon: null });
        expect(container).toBeEmptyDOMElement();
    });

    it('starts collapsed — stat grid is hidden until the header is clicked', () => {
        renderPanel();
        expect(screen.queryByText('Reset All Stages')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /show combat stages/i }));
        expect(screen.getByText('Reset All Stages')).toBeInTheDocument();
    });

    it('shows ATK/DEF/SATK/SDEF stages as damage dice, not a stat change (PTA3.5 rule)', () => {
        renderPanel({ combatStages: { atk: 2 } });
        fireEvent.click(screen.getByRole('button', { name: /show combat stages/i }));
        // atk stages don't touch the stat anymore — they add damage dice, 1:1 with stage count
        const atkBox = screen.getByText('ATK').closest('.combat-stat-box');
        expect(within(atkBox).getByText(/dice:/)).toHaveTextContent('dice: +2');
    });

    it('shows negative stages as removed damage dice', () => {
        renderPanel({ combatStages: { def: -1 } });
        fireEvent.click(screen.getByRole('button', { name: /show combat stages/i }));
        const defBox = screen.getByText('DEF').closest('.combat-stat-box');
        expect(within(defBox).getByText(/dice:/)).toHaveTextContent('dice: -1');
    });

    it('applies flat ±5 per stage to Speed (the one stat stages still modify directly)', () => {
        renderPanel({ combatStages: { spd: 2 } });
        fireEvent.click(screen.getByRole('button', { name: /show combat stages/i }));
        // spd base 14, +2 stages * 5 = +10 -> 24
        const spdBox = screen.getByText('SPD').closest('.combat-stat-box');
        expect(within(spdBox).getByText('24')).toBeInTheDocument();
    });

    it('shows ACC/EVA as a flat modifier (no base stat math)', () => {
        renderPanel({ combatStages: { acc: 3 } });
        fireEvent.click(screen.getByRole('button', { name: /show combat stages/i }));
        const accBox = screen.getByText('ACC').closest('.combat-stat-box');
        expect(within(accBox).getByText(/mod:/)).toHaveTextContent('mod: +3');
    });

    it('calls updateCombatStage with +1/-1 when the stage buttons are clicked', () => {
        const { props } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: /show combat stages/i }));
        fireEvent.click(screen.getByRole('button', { name: 'Increase ATK' }));
        expect(props.updateCombatStage).toHaveBeenCalledWith('atk', 1);
        fireEvent.click(screen.getByRole('button', { name: 'Decrease ATK' }));
        expect(props.updateCombatStage).toHaveBeenCalledWith('atk', -1);
    });

    it('calls resetCombatStages when Reset All Stages is clicked', () => {
        const { props } = renderPanel();
        fireEvent.click(screen.getByRole('button', { name: /show combat stages/i }));
        fireEvent.click(screen.getByText('Reset All Stages'));
        expect(props.resetCombatStages).toHaveBeenCalled();
    });
});
