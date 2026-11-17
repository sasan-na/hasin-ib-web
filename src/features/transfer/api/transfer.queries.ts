import {queryOptions} from "@tanstack/react-query"

import {getFrequencies, getStandingOrders} from "./standing-order"
import {getReasonCodes} from "./transfer"

// Reason names come from the bank in the UI language, so it is part of the key.
export const transferKeys = {
	all: ["transfer"] as const,
	standingOrders: ["transfer", "standing-orders"] as const,
	reasons: (language: string) => [...transferKeys.all, "reasons", language] as const,
}

export const reasonCodesOptions = (language: string) =>
	queryOptions({queryKey: transferKeys.reasons(language), queryFn: getReasonCodes, staleTime: 10 * 60_000, retry: false})

export const standingOrdersOptions = (count: number) =>
	queryOptions({queryKey: [...transferKeys.standingOrders, count], queryFn: () => getStandingOrders(count), retry: false})

// The unit names come from the bank in the UI language.
export const frequenciesOptions = (language: string) =>
	queryOptions({queryKey: [...transferKeys.standingOrders, "frequencies", language], queryFn: getFrequencies, staleTime: 10 * 60_000, retry: false})
