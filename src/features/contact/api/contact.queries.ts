import {queryOptions} from "@tanstack/react-query"

import {getContact, getContactLimits, getContacts} from "./contact"

export const contactKeys = {
	all: ["contact"] as const,
	list: ["contact", "list"] as const,
	one: (id: number) => ["contact", "one", id] as const,
	limits: ["contact", "limits"] as const,
}

export const contactsOptions = () => queryOptions({queryKey: contactKeys.list, queryFn: getContacts, retry: false})

// Edited from a form that must start from what the server holds now, so it is never served from a stale cache.
export const contactOptions = (id: number) => queryOptions({queryKey: contactKeys.one(id), queryFn: () => getContact(id), staleTime: 0, gcTime: 0, retry: false})

export const contactLimitsOptions = () => queryOptions({queryKey: contactKeys.limits, queryFn: getContactLimits, staleTime: 10 * 60_000, retry: false})
