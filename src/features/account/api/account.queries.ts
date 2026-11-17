import {queryOptions} from "@tanstack/react-query"
import {getAccountPasswordDetails, getGateways} from "./account-password"

import {getAccountInfo, getAccounts, getWithdrawRules} from "./account"

// Account names, types and rule texts come from the server in the UI language, so the language is part of the key.
export const accountKeys = {
	all: ["account"] as const,
	list: (language: string) => [...accountKeys.all, "list", language] as const,
	info: (accountId: number, language: string) => [...accountKeys.all, "info", accountId, language] as const,
	withdrawRules: (accountId: number, language: string) => [...accountKeys.all, "withdrawRules", accountId, language] as const,
	password: (accountId: number) => [...accountKeys.all, "password", accountId] as const,
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

export const accountPasswordDetailsOptions = (accountId: number) =>
	queryOptions({queryKey: accountKeys.password(accountId), queryFn: () => getAccountPasswordDetails(accountId), retry: false})

export const gatewaysOptions = (accountId: number) =>
	queryOptions({queryKey: [...accountKeys.password(accountId), "gateways"], queryFn: () => getGateways(accountId), retry: false})
