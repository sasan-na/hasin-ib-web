import {queryOptions} from "@tanstack/react-query"

import {getSavedDestinations, type DestinationKind} from "./destinations"
import {getFrequencies, getStandingOrders} from "./standing-order"
import {getIbanLimits, getReasonCodes, type IbanNetwork} from "./transfer"

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

export const ibanLimitsOptions = (network: IbanNetwork) =>
	queryOptions({queryKey: [...transferKeys.all, "iban-limits", network], queryFn: () => getIbanLimits(network), staleTime: 10 * 60_000, retry: false})

// Saved destinations are the user's own data, so they are kept for a short while only.
export const savedDestinationsOptions = (kind: DestinationKind) =>
	queryOptions({queryKey: [...transferKeys.all, "saved-destinations", kind], queryFn: () => getSavedDestinations(kind), staleTime: 60_000, retry: false})
