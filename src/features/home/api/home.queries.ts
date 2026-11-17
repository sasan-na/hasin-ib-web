import {queryOptions} from "@tanstack/react-query"

import {getAdminMessage, getProfile, getRecentTransactions} from "./home"

// The server writes some texts in the UI language, so those queries are keyed by it and refetch on a switch.
export const homeKeys = {
	all: ["home"] as const,
	profile: () => [...homeKeys.all, "profile"] as const,
	adminMessage: (language: string) => [...homeKeys.all, "adminMessage", language] as const,
	recentTransactions: (language: string) => [...homeKeys.all, "recentTransactions", language] as const,
}

export const profileOptions = () =>
	queryOptions({
		queryKey: homeKeys.profile(),
		queryFn: getProfile,
		staleTime: 5 * 60_000,
		retry: false,
	})

export const adminMessageOptions = (language: string) =>
	queryOptions({
		queryKey: homeKeys.adminMessage(language),
		queryFn: getAdminMessage,
		staleTime: 5 * 60_000,
		retry: false,
	})

export const recentTransactionsOptions = (language: string) =>
	queryOptions({
		queryKey: homeKeys.recentTransactions(language),
		queryFn: getRecentTransactions,
		staleTime: 60_000,
		retry: false,
	})
