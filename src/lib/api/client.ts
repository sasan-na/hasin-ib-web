import {queryClient} from "@/lib/query-client"
import {useSession} from "@/store/session"

import {getXsrfToken, XSRF_HEADER_NAME} from "./xsrf"

// Legacy server API root, e.g. https://ib.radin.tech/api. Defaults to same-origin /api (dev mocks).
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

const hasExpiredErrorCode = (data: unknown): boolean => {
	if (data === null || typeof data !== "object") return false
	const obj = data as Record<string, unknown>
	return String(obj.errorCode ?? obj.ErrorCode ?? "") === "401"
}

export const apiClient = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
	const token = useSession.getState().token
	const xsrfToken = getXsrfToken()
	const response = await fetch(`${API_BASE_URL}${endpoint}`, {
		// The server sets its XSRF cookie on login and reads it back later: cookies must be sent cross-origin.
		credentials: "include",
		...options,
		headers: {
			"Content-Type": "application/json",
			// The raw JWT, no "Bearer " prefix: the server decodes the whole header value.
			...(token ? {Authorization: token} : {}),
			...(xsrfToken ? {[XSRF_HEADER_NAME]: xsrfToken} : {}),
			...(options?.headers as Record<string, string> | undefined),
		},
	})

	if (response.status === 401) expireSession()

	if (!response.ok) {
		let message: string
		try {
			message = extractErrorMessage(await response.json()) ?? response.statusText
		} catch {
			message = response.statusText
		}
		throw new ApiError(response.status, message || `HTTP ${String(response.status)}`)
	}

	const data: unknown = await response.json()
	if (hasExpiredErrorCode(data)) {
		expireSession()
		throw new ApiError(401, extractErrorMessage(data) ?? response.statusText)
	}
	return data as T
}

/** Ends the server session (`api/Login/Logout`). */
export const logoutRequest = () => apiClient<unknown>("/Login/Logout", {method: "POST"})
