/**
 * Double-submit XSRF protection used by the server (`ValidateAntiForgeryTokenFilter.cs`): after a
 * login it sets a script-readable `XSRF-TOKEN` cookie, and every POST must echo that value in the
 * `X-XSRF-TOKEN` header. The server compares the two; the cookie rides along with
 * `credentials: 'include'`, the header is what only a script on our own origin can add.
 */
export const XSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const XSRF_HEADER_NAME = 'X-XSRF-TOKEN';

/** The current XSRF token, or `null` while the server has not set the cookie (before login). */
export const getXsrfToken = (): string | null => {
    const prefix = `${XSRF_COOKIE_NAME}=`;
    const pair = document.cookie
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(prefix));
    const raw = pair?.slice(prefix.length);
    if (!raw) return null;

    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
};
