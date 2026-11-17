import {infiniteQueryOptions, queryOptions} from "@tanstack/react-query"

import {getChequeSeries, getChequeStatuses, getCheques, type ChequeFilter} from "./cheque"

export const PAGE_SIZE = 20

export const chequeKeys = {
	all: ["cheque"] as const,
	statuses: (language: string) => ["cheque", "statuses", language] as const,
	series: (accountNumber: string) => ["cheque", "series", accountNumber] as const,
	list: (filter: ChequeFilter) => ["cheque", "list", filter] as const,
}

export const chequeStatusesOptions = (language: string) => queryOptions({queryKey: chequeKeys.statuses(language), queryFn: getChequeStatuses, staleTime: 10 * 60_000, retry: false})

/** Only meaningful after the list has been fetched for the account, because the bank answers from that fetch. */
export const chequeSeriesOptions = (accountNumber: string, enabled: boolean) =>
	queryOptions({queryKey: chequeKeys.series(accountNumber), queryFn: () => getChequeSeries(accountNumber), enabled, staleTime: 60_000, retry: false})

// The bank reads its core system for the first page, so the result is kept for a minute and refreshed on request.
export const chequesOptions = (filter: ChequeFilter, enabled: boolean) =>
	infiniteQueryOptions({
		queryKey: chequeKeys.list(filter),
		queryFn: ({pageParam}) => getCheques(filter, pageParam, PAGE_SIZE),
		initialPageParam: 0,
		getNextPageParam: (last, pages) => (last.hasMore ? pages.length * PAGE_SIZE : undefined),
		enabled,
		staleTime: 60_000,
		retry: false,
	})
