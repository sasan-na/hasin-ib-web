import {queryOptions} from "@tanstack/react-query"

import {getAccounts} from "./account"

// Account names and types come from the server in the UI language, so the language is part of the key.
export const accountKeys = {
	all: ["account"] as const,
	list: (language: string) => [...accountKeys.all, "list", language] as const,
}

export const accountsOptions = (language: string) =>
	queryOptions({
		queryKey: accountKeys.list(language),
		queryFn: getAccounts,
		staleTime: 60_000,
		retry: false,
	})
