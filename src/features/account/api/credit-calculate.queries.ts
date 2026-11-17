import {queryOptions} from "@tanstack/react-query"

import {getLoanOptions} from "./credit-calculate"

export const creditKeys = {
	options: (accountNumber: string) => ["credit", "options", accountNumber] as const,
}

export const loanOptionsOptions = (accountNumber: string) =>
	queryOptions({queryKey: creditKeys.options(accountNumber), queryFn: () => getLoanOptions(accountNumber), staleTime: 5 * 60_000, retry: false})
