/**
 * How the legacy server expects passwords on the change-password calls (`PasswordUtilities.GetPlainPassword`),
 * reproduced from the legacy client (`crypto-service.js`):
 *
 * - a fresh `ticket` per request: a UUID without dashes (32 hex characters);
 * - key = ticket XOR a fixed mask, character by character in base 32, upper-cased (32 characters);
 * - AES-CBC, PKCS7, IV = sixteen "0" characters, base64 - the same cipher as the login.
 *
 * Like the login, this is obfuscation on top of HTTPS, not secrecy: the mask ships in every legacy bundle.
 */
import {encryptWithKey} from "./login-crypto"

const SERVER_MASK = "1954DCDF58454D5C94846A3ED24DCB6C"
const KEY_LENGTH = 32

/** The per-request key for `ticket`: XOR with the mask, one base-32 digit at a time. */
export const passwordKey = (ticket: string): string => {
	let key = ""
	for (let index = 0; index < KEY_LENGTH; index++) {
		const digit = Number.parseInt(ticket.charAt(index), 32) ^ Number.parseInt(SERVER_MASK.charAt(index), 32)
		key += digit.toString(32).toUpperCase()
	}
	return key
}

export interface ProtectedPasswords {
	ticket: string
	/** The passwords, encrypted, in the order they were given. */
	encrypted: string[]
}

/** Encrypts `passwords` under one fresh ticket. */
export const protectPasswords = async (...passwords: string[]): Promise<ProtectedPasswords> => {
	const ticket = crypto.randomUUID().replace(/-/g, "")
	const key = passwordKey(ticket)
	const encrypted = await Promise.all(passwords.map((password) => encryptWithKey(password, key)))
	return {ticket, encrypted}
}
