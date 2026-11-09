// ============================================================
// useDiscordWebhook Hook
// ============================================================
// Discord webhook integration for dice roll sharing

import { useState, useEffect, useCallback } from 'react';
import { buildEmbed } from '../utils/discordEmbeds.js';
import toast from '../utils/toast.js';

export const useDiscordWebhook = () => {
    const [webhook, setWebhook] = useState(() => {
        try {
            const saved = localStorage.getItem('pta35-discord-webhook');
            return saved ? JSON.parse(saved) : { url: '', enabled: false, showSettings: false };
        } catch {
            return { url: '', enabled: false, showSettings: false };
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('pta35-discord-webhook', JSON.stringify({
                url: webhook.url,
                enabled: webhook.enabled,
                showSettings: false,
            }));
        } catch {
            console.warn('Could not save Discord webhook settings');
        }
    }, [webhook.url, webhook.enabled]);

    const sendToDiscord = useCallback(async (roll, trainerName = 'Trainer') => {
        if (!webhook.enabled || !webhook.url) return;
        const embed = buildEmbed(roll, trainerName);
        if (!embed) return;
        try {
            const res = await fetch(webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: 'PTA Dice Roller',
                    avatar_url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png',
                    embeds: [embed],
                }),
            });
            if (!res.ok) {
                const msg = res.status === 401 || res.status === 403
                    ? 'Discord webhook rejected. Check your webhook URL.'
                    : `Discord send failed (${res.status}). Check your webhook URL.`;
                toast.error(msg);
            }
        } catch (error) {
            console.error('Failed to send to Discord:', error);
            toast.error('Could not reach Discord. Check your internet connection.');
        }
    }, [webhook.enabled, webhook.url]);

    const updateWebhook = useCallback((updates) => {
        setWebhook(prev => ({ ...prev, ...updates }));
    }, []);

    const toggleSettings = useCallback(() => {
        setWebhook(prev => ({ ...prev, showSettings: !prev.showSettings }));
    }, []);

    return {
        webhook,
        setWebhook,
        updateWebhook,
        toggleSettings,
        sendToDiscord,
        isConfigured: webhook.enabled && webhook.url,
    };
};

export default useDiscordWebhook;
