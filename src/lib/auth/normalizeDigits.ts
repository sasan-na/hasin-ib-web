const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;
const NON_ASCII_DIGIT = /[۰-۹٠-٩]/g;

/**
 * Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII 0-9, leaving every other character alone.
 * A username typed on a Persian keyboard must reach the server in ASCII.
 */
export const normalizeDigits = (value: string): string =>
    value.replace(NON_ASCII_DIGIT, (character) => {
        const code = character.charCodeAt(0);
        return String(code - (code >= PERSIAN_ZERO ? PERSIAN_ZERO : ARABIC_ZERO));
    });
