import {queryOptions} from "@tanstack/react-query"

import {getSavedBills} from "./bill"

export const billKeys = {
	all: ["bill"] as const,
	saved: ["bill", "saved"] as const,
}

export const savedBillsOptions = () => queryOptions({queryKey: billKeys.saved, queryFn: getSavedBills, retry: false})
