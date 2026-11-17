import {queryOptions} from "@tanstack/react-query"

import {getEtcList} from "./etc"

export const etcKeys = {all: ["etc"] as const, list: () => [...etcKeys.all, "list"] as const}

// The bank asks the toll operator for the list, so it is kept for a minute and refreshed on request.
export const etcListOptions = () => queryOptions({queryKey: etcKeys.list(), queryFn: getEtcList, staleTime: 60_000, retry: false})
