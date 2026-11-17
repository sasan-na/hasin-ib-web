import {QueryClient} from "@tanstack/react-query"

import {ApiError} from "@/lib/api/client"

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60_000,
			refetchOnWindowFocus: false,
			// An expired session will not heal by asking again.
			retry: (failureCount, error) => !(error instanceof ApiError && error.status === 401) && failureCount < 1,
		},
		mutations: {
			retry: 0,
		},
	},
})
