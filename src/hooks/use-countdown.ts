import { useEffect, useState } from 'react';

const TICK_MS = 1000;

interface Countdown {
    /** Whole seconds left, never below zero. */
    secondsLeft: number;
    isDone: boolean;
    /** Starts the full duration again. */
    restart: () => void;
}

/**
 * Counts `seconds` down to zero, starting when the component mounts. The remaining time is derived
 * from a start time rather than decremented, so a throttled background tab catches up instead of
 * running slow.
 */
export const useCountdown = (seconds: number): Countdown => {
    const [startedAt, setStartedAt] = useState(() => Date.now());
    const [now, setNow] = useState(startedAt);

    useEffect(() => {
        const timer = setInterval(() => {
            const current = Date.now();
            setNow(current);
            if (current - startedAt >= seconds * TICK_MS) clearInterval(timer);
        }, TICK_MS);
        return () => {
            clearInterval(timer);
        };
    }, [startedAt, seconds]);

    const secondsLeft = Math.max(0, seconds - Math.floor((now - startedAt) / TICK_MS));

    return {
        secondsLeft,
        isDone: secondsLeft === 0,
        restart: () => {
            const current = Date.now();
            setStartedAt(current);
            setNow(current);
        }
    };
};
