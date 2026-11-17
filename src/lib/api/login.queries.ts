import {queryOptions} from "@tanstack/react-query"

import {initializeLogin} from "./login"

export const loginKeys = {
	all: ["login"] as const,
	session: () => [...loginKeys.all, "session"] as const,
}

/**
 * The login page's session: a single-use guid plus its captcha. A cached copy would be a consumed
 * guid, so it is never reused (gcTime 0), never refreshed on its own, and re-fetched explicitly
 * with refetch() after every attempt.
 */
export const loginSessionOptions = () =>
	queryOptions({
		queryKey: loginKeys.session(),
		queryFn: ({signal}) => initializeLogin(signal),
		staleTime: Infinity,
		gcTime: 0,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	})
