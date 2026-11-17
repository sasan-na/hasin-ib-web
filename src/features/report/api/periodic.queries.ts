import {queryOptions} from "@tanstack/react-query"

import {getPeriodicInvoices, getPeriods, getStatementFields} from "./periodic"

export const periodicKeys = {
	all: ["report", "periodic"] as const,
	list: ["report", "periodic", "list"] as const,
	periods: (language: string) => ["report", "periodic", "periods", language] as const,
	fields: (language: string) => ["report", "periodic", "fields", language] as const,
}

export const periodicInvoicesOptions = () => queryOptions({queryKey: periodicKeys.list, queryFn: getPeriodicInvoices, retry: false})

// Names come from the server in the UI language, so the language is part of the key.
export const periodsOptions = (language: string) => queryOptions({queryKey: periodicKeys.periods(language), queryFn: getPeriods, staleTime: 10 * 60_000, retry: false})

export const statementFieldsOptions = (language: string) => queryOptions({queryKey: periodicKeys.fields(language), queryFn: getStatementFields, staleTime: 10 * 60_000, retry: false})
