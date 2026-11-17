import {queryOptions} from "@tanstack/react-query"

import {canSyncAccounts, getAccountInfo, getAccounts, getWithdrawRules} from "./account"

// Account names, types and rule texts come from the server in the UI language, so the language is part of the key.
export const accountKeys = {
	all: ["account"] as const,
	list: (language: string) => [...accountKeys.all, "list", language] as const,
	info: (accountId: number, language: string) => [...accountKeys.all, "info", accountId, language] as const,
	withdrawRules: (accountId: number, language: string) => [...accountKeys.all, "withdrawRules", accountId, language] as const,
	syncAllowed: () => [...accountKeys.all, "syncAllowed"] as const,
}

export const accountsOptions = (language: string) =>
	queryOptions({
		queryKey: accountKeys.list(language),
		queryFn: getAccounts,
		staleTime: 60_000,
		retry: false,
	})

export const accountInfoOptions = (accountId: number, language: string) =>
	queryOptions({
		queryKey: accountKeys.info(accountId, language),
		queryFn: () => getAccountInfo(accountId),
		retry: false,
	})

export const withdrawRulesOptions = (accountId: number, language: string) =>
	queryOptions({
		queryKey: accountKeys.withdrawRules(accountId, language),
		queryFn: () => getWithdrawRules(accountId),
		staleTime: 5 * 60_000,
		retry: false,
	})

/** Whether the "refresh account list" button applies to this user; it is a fact about them, so it is kept. */
export const syncAllowedOptions = () =>
	queryOptions({
		queryKey: accountKeys.syncAllowed(),
		queryFn: canSyncAccounts,
		staleTime: Infinity,
		retry: false,
	})
