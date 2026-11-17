import {queryOptions} from "@tanstack/react-query"

import {getReasonCodes} from "./transfer"

// Reason names come from the bank in the UI language, so it is part of the key.
export const transferKeys = {
	all: ["transfer"] as const,
	reasons: (language: string) => [...transferKeys.all, "reasons", language] as const,
}

export const reasonCodesOptions = (language: string) =>
	queryOptions({queryKey: transferKeys.reasons(language), queryFn: getReasonCodes, staleTime: 10 * 60_000, retry: false})
