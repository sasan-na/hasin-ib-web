// Signing with a certificate on the customer's own token is done by "Dastine", a vendor library that talks to a small service
// installed on the customer's computer over a local WebSocket. Its two script files live in public/dastine (copied unchanged
// from the legacy client) and are loaded only when the customer asks to sign, so nobody else pays for them.

interface DastineResult {
	data?: {Result?: string}
}

interface DastineApi {
	/** True once the local service has answered. */
	isInstalled: boolean
	SelectCertificateFromTokenByUI: (issuer: string, keyUsages: string, callback: (result: DastineResult) => void) => void
	GetSelectedCertificate: (callback: (result: DastineResult) => void) => void
	Sign: (data: string, hash: string, callback: (result: DastineResult) => void) => void
}

declare global {
	interface Window {
		Dastine?: DastineApi
		DastineInstaller?: {createConnection: () => void}
		BrowserDetector?: {init: () => void}
	}
}

/** Dastine answered with an error code, or the signing service is not on this computer (`code` "missing"). */
export class DastineError extends Error {
	readonly code: string
	constructor(code: string) {
		super(`dastine ${code}`)
		this.code = code
	}
}

/** The codes the library gives for the things that go wrong, which the customer can understand. */
export const DASTINE_ERROR_CODES = ["11", "12", "18", "20", "24", "25", "30", "31", "32", "33", "34", "80"] as const

const loadScript = (src: string): Promise<void> =>
	new Promise((resolve, reject) => {
		const script = document.createElement("script")
		script.src = src
		script.async = false
		script.onload = () => resolve()
		script.onerror = () => reject(new DastineError("missing"))
		document.head.appendChild(script)
	})

let loading: Promise<DastineApi> | null = null

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const waitUntilInstalled = async (ms: number): Promise<boolean> => {
	for (let waited = 0; waited < ms; waited += 250) {
		if (window.Dastine?.isInstalled) return true
		await wait(250)
	}
	return window.Dastine?.isInstalled === true
}

/** Loads the library once and waits for the signing service on this computer to answer. Throws DastineError("missing") when it does not. */
export const loadDastine = (): Promise<DastineApi> => {
	loading ??= (async () => {
		if (!window.Dastine) {
			await loadScript("/dastine/Dastine-Config.js")
			await loadScript("/dastine/Dastine.js")
		}
		if (!(await waitUntilInstalled(4000))) {
			// One more try: the first connection may have been refused while the service was still starting.
			window.BrowserDetector?.init()
			window.DastineInstaller?.createConnection()
			if (!(await waitUntilInstalled(4000))) throw new DastineError("missing")
		}
		return window.Dastine as DastineApi
	})().catch((error) => {
		// A later attempt (after installing the service) must be able to try again.
		loading = null
		throw error
	})
	return loading
}

const FAILED_SELECT = ["11", "80", "20"]
const FAILED_SIGN = ["30", "12", "31", "32", "33", "11", "34", "80", "14", "18"]

/** Lets the customer pick their certificate on the token (the service shows its own window and asks for the PIN). Resolves with the certificate. */
export const selectCertificate = (dastine: DastineApi): Promise<string> =>
	new Promise((resolve, reject) => {
		dastine.SelectCertificateFromTokenByUI("", "", (selected) => {
			const code = selected.data?.Result
			if (code !== "0") return reject(new DastineError(code ?? "unknown"))
			dastine.GetSelectedCertificate((certificate) => {
				const value = certificate.data?.Result
				if (!value || FAILED_SELECT.includes(value)) return reject(new DastineError(value ?? "unknown"))
				resolve(value)
			})
		})
	})

/** Signs a digest with the private key on the token. Resolves with the signature. */
export const signDigest = (dastine: DastineApi, digest: string): Promise<string> =>
	new Promise((resolve, reject) => {
		dastine.Sign(digest, "SHA256", (signed) => {
			const value = signed.data?.Result
			if (!value || FAILED_SIGN.includes(value)) return reject(new DastineError(value ?? "unknown"))
			resolve(value)
		})
	})
