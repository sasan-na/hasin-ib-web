import {queryOptions} from "@tanstack/react-query"

import {getCards} from "./card"
import {getCardInfo, getCardOwner} from "./card-info"

// Card names and types come from the server in the UI language, so the language is part of the key.
export const cardKeys = {
	all: ["card"] as const,
	list: (language: string) => [...cardKeys.all, "list", language] as const,
	info: (cardId: number) => [...cardKeys.all, "info", cardId] as const,
	owner: (cardId: number) => [...cardKeys.all, "owner", cardId] as const,
}

export const cardsOptions = (language: string) => queryOptions({queryKey: cardKeys.list(language), queryFn: getCards, staleTime: 60_000, retry: false})

export const cardInfoOptions = (cardId: number) => queryOptions({queryKey: cardKeys.info(cardId), queryFn: () => getCardInfo(cardId), retry: false})

/** The holder's name and photo: slow to come, so it is its own query and the page does not wait for it. */
export const cardOwnerOptions = (cardId: number) =>
	queryOptions({queryKey: cardKeys.owner(cardId), queryFn: () => getCardOwner(cardId), staleTime: 5 * 60_000, retry: false})
