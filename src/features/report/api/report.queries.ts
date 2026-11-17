import {queryOptions} from "@tanstack/react-query"

import {getStatementTypes} from "./statement"

export const reportKeys = {
	all: ["report"] as const,
	statementTypes: (accountId: number | null) => [...reportKeys.all, "statement-types", accountId] as const,
}

/** The kinds of statement for one account; disabled until an account is chosen. */
export const statementTypesOptions = (accountId: number | null) =>
	queryOptions({queryKey: reportKeys.statementTypes(accountId), queryFn: () => getStatementTypes(accountId as number), enabled: accountId !== null, staleTime: 5 * 60_000, retry: false})
