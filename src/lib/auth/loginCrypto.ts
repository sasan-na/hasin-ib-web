/**
 * The credential protection the legacy server expects at login (`LoginController.cs`: `DecryptUsername`,
 * `DecryptPassword`, `SaveLoginTryAsync`). Reproduced exactly, because the server decodes what we send:
 *
 * - username and password: AES-CBC, PKCS7, key = the session `guid` without dashes read as 32 UTF-8
 *   bytes (so AES-256), IV = sixteen `0` characters, output base64. The username is lower-cased first.
 * - captcha: base64 of MD5(`guid + CAPTCHA_SALT + lower(captcha)`).
 *
 * This is obfuscation, not secrecy: the key is the public `guid` and the IV is constant. Confidentiality
 * comes from HTTPS. A stronger scheme is a server-side decision.
 */
import { md5 } from './md5';

/** Shared with the server (`SaveLoginTryAsync`); it already ships in the legacy bundle. */
export const CAPTCHA_SALT = 'CIe3!D^H7w2&Y#OSVxKop[BQ+;MRXl=Uf0:Jc@1N';

const encoder = new TextEncoder();
const AES_BLOCK_BYTES = 16;
const AES_IV = encoder.encode('0'.repeat(AES_BLOCK_BYTES));

const toBase64 = (bytes: Uint8Array): string =>
    btoa(bytes.reduce((text, byte) => text + String.fromCharCode(byte), ''));

const encrypt = async (message: string, guid: string): Promise<string> => {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(guid.replace(/-/g, '')),
        'AES-CBC',
        false,
        ['encrypt']
    );
    const cipher = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv: AES_IV },
        key,
        encoder.encode(message)
    );
    return toBase64(new Uint8Array(cipher));
};

/** AES-CBC with a caller-supplied 32-character key (see `passwordCrypto.ts`); same IV and output as login. */
export const encryptWithKey = encrypt;

/** The server lower-cases the username too, so it is lower-cased before it is encrypted. */
export const encryptUsername = (username: string, guid: string): Promise<string> =>
    encrypt(username.toLowerCase(), guid);

export const encryptPassword = (password: string, guid: string): Promise<string> =>
    encrypt(password, guid);

export const hashCaptcha = (captcha: string, guid: string): string =>
    toBase64(md5(encoder.encode(`${guid}${CAPTCHA_SALT}${captcha.toLowerCase()}`)));
