import {queryOptions} from "@tanstack/react-query"

import {getBranches} from "./branch"

// Branch names come from the bank in the UI language, so it is part of the key.
export const branchesOptions = (language: string) =>
	queryOptions({queryKey: ["branches", language] as const, queryFn: getBranches, staleTime: 10 * 60_000, retry: false})
