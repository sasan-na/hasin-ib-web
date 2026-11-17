import i18n from "i18next"

import {queryClient} from "@/lib/query-client"
import {useSession} from "@/store/session"

import {getXsrfToken, XSRF_HEADER_NAME} from "./xsrf"

// Legacy server API root, e.g. https://ib.radin.tech/api. Defaults to same-origin /api (proxied to the real server in dev).
export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "/api"

export class ApiError extends Error {
	readonly status: number

	constructor(status: number, message: string) {
		super(message)
		this.name = "ApiError"
		this.status = status
	}
}

const extractErrorMessage = (data: unknown): string | null => {
	if (data === null || typeof data !== "object") return null
	const obj = data as Record<string, unknown>
	if (typeof obj.message === "string") return obj.message
	if (typeof obj.Message === "string") return obj.Message
	return null
}

/** The server ended the session (HTTP 401, or `ErrorCode: "401"` in the body): back to the login page. */
const expireSession = (): void => {
	// Only a signed-in session can expire; this also keeps parallel failing calls from acting twice.
	if (useSession.getState().token === null) return
	useSession.getState().expireSession()
	// Nothing fetched for the old session may be shown to whoever signs in next.
	queryClient.clear()
}

/** HTTP 403 while signed in: the server wants a new password before it serves anything else. */
const requirePasswordChange = (): void => {
	if (useSession.getState().token === null) return
	useSession.getState().requirePasswordChange()
}

const hasExpiredErrorCode = (data: unknown): boolean => {
	if (data === null || typeof data !== "object") return false
	const obj = data as Record<string, unknown>
	return String(obj.errorCode ?? obj.ErrorCode ?? "") === "401"
}

/**
 * The server writes its texts (dates, status titles, messages) in the language of the `lang` query
 * parameter and falls back to Persian without it, so every call carries the current UI language.
 */
const withLang = (endpoint: string): string => {
	const lang = i18n.language === "en" ? "en" : "fa"
	return `${endpoint}${endpoint.includes("?") ? "&" : "?"}lang=${lang}`
}

/** Sends a request with the session's credentials and turns the failures every call shares (expired session, HTTP errors) into exceptions. */
const send = async (endpoint: string, options?: RequestInit): Promise<Response> => {
	const token = useSession.getState().token
	const xsrfToken = getXsrfToken()
	const response = await fetch(`${API_BASE_URL}${withLang(endpoint)}`, {
		// The server sets its XSRF cookie on login and reads it back later: cookies must be sent cross-origin.
		credentials: "include",
		...options,
		headers: {
			// A file upload sets its own type (with the multipart boundary); everything else is JSON.
			...(options?.body instanceof FormData ? {} : {"Content-Type": "application/json"}),
			// The raw JWT, no "Bearer " prefix: the server decodes the whole header value.
			...(token ? {Authorization: token} : {}),
			...(xsrfToken ? {[XSRF_HEADER_NAME]: xsrfToken} : {}),
			...(options?.headers as Record<string, string> | undefined),
		},
	})

	if (response.status === 401) expireSession()
	if (response.status === 403) requirePasswordChange()

	if (!response.ok) {
		let message: string
		try {
			message = extractErrorMessage(await response.json()) ?? response.statusText
		} catch {
			message = response.statusText
		}
		throw new ApiError(response.status, message || `HTTP ${String(response.status)}`)
	}
	return response
}

export const apiClient = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
	const response = await send(endpoint, options)
	const data: unknown = await response.json()
	if (hasExpiredErrorCode(data)) {
		expireSession()
		throw new ApiError(401, extractErrorMessage(data) ?? response.statusText)
	}
	return data as T
}

/** Like `apiClient`, for answers that are a file (a PDF, a spreadsheet) rather than JSON. */
export const apiBlob = async (endpoint: string, options?: RequestInit): Promise<Blob> => (await send(endpoint, options)).blob()

/** Ends the server session (`api/Login/Logout`). */
export const logoutRequest = () => apiClient<unknown>("/Login/Logout", {method: "POST"})
