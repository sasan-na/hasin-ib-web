import {queryOptions} from "@tanstack/react-query"

import {getPasswordInfo, getSourceAccounts, getTransactionConfig} from "./transaction"

export const transactionKeys = {
	all: ["transaction"] as const,
	sourceAccounts: (serviceName: string, language: string) => [...transactionKeys.all, "sourceAccounts", serviceName, language] as const,
	config: () => [...transactionKeys.all, "config"] as const,
	passwordInfo: (accountId: number, language: string) => [...transactionKeys.all, "passwordInfo", accountId, language] as const,
}

// Account names and the bank's code names come in the UI language, so it is part of those keys.
export const sourceAccountsOptions = (serviceName: string, language: string) =>
	queryOptions({
		queryKey: transactionKeys.sourceAccounts(serviceName, language),
		queryFn: () => getSourceAccounts(serviceName),
		retry: false,
		// A balance on screen must not be a stale one when the user comes back to confirm.
		staleTime: 0,
	})

export const transactionConfigOptions = () =>
	queryOptions({
		queryKey: transactionKeys.config(),
		queryFn: getTransactionConfig,
		staleTime: 10 * 60_000,
		retry: false,
	})

export const passwordInfoOptions = (accountId: number, language: string) =>
	queryOptions({
		queryKey: transactionKeys.passwordInfo(accountId, language),
		queryFn: () => getPasswordInfo(accountId),
		staleTime: 60_000,
		retry: false,
	})
