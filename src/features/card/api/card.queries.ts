import {queryOptions} from "@tanstack/react-query"

import {getCards} from "./card"

// Card names and types come from the server in the UI language, so the language is part of the key.
export const cardKeys = {
	all: ["card"] as const,
	list: (language: string) => [...cardKeys.all, "list", language] as const,
}

export const cardsOptions = (language: string) => queryOptions({queryKey: cardKeys.list(language), queryFn: getCards, staleTime: 60_000, retry: false})
