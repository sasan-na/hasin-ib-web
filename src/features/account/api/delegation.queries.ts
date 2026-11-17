import {queryOptions} from "@tanstack/react-query"

import {getOrgans} from "./delegation"

// Organ names come from the bank in the UI language, so it is part of the key.
export const delegationKeys = {
	organs: (language: string) => ["delegation", "organs", language] as const,
}

export const organsOptions = (language: string) =>
	queryOptions({queryKey: delegationKeys.organs(language), queryFn: getOrgans, staleTime: 10 * 60_000, retry: false})
