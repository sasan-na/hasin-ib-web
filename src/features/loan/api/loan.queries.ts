import {queryOptions} from "@tanstack/react-query"

import {getInterestOptions} from "./interest"
import {getLoans} from "./loan"

export const loanKeys = {
	all: ["loan"] as const,
	interest: () => [...loanKeys.all, "interest"] as const,
	list: (language: string) => [...loanKeys.all, "list", language] as const,
}

// The bank asks its core system for every loan, so the list is kept for a minute and refreshed on request.
export const loansOptions = (language: string) => queryOptions({queryKey: loanKeys.list(language), queryFn: getLoans, staleTime: 60_000, retry: false})

// The bank's loan kinds change rarely, so they are kept for ten minutes.
export const interestOptionsOptions = () => queryOptions({queryKey: loanKeys.interest(), queryFn: getInterestOptions, staleTime: 600_000, retry: false})
