import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"

// camelCase, like the other post-login endpoints.
const service = z.object({key: z.string().nullish(), isEnabled: z.boolean().nullish()})
const amount = z.number().nullish()

const cardSchema = z.object({
	id: z.number(),
	name: z.string().nullish(),
	number: z.string().nullish(),
	owner: z.string().nullish(),
	type: z.string().nullish(),
	balance: amount,
	defaultAccountNumber: z.string().nullish(),
	category: z.object({key: z.string().nullish(), name: z.string().nullish()}).nullish(),
	services: z.array(service).nullish(),
	defaultServices: z.array(service).nullish(),
})

const cardListSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	cardList: z.array(cardSchema).nullish(),
})

export interface CardBalances {
	/** What can be spent. */
	available: number | null
	total: number | null
	blocked: number | null
}

export interface Card {
	id: number
	name: string
	number: string
	/** The card holder's name. */
	owner: string
	type: string
	/** The account the card draws on by default; empty when the bank does not say. */
	defaultAccountNumber: string
	categoryKey: string
	categoryName: string
	/** The bank's per-card services that are switched on ("Balance", "Info", "Block", ...). */
	services: ReadonlySet<string>
	/** What the list already carried; null until the user asks for a fresh balance. */
	balances: CardBalances
}

/** The user's cards in the order they chose (the server sorts by category, then their priority). */
export const getCards = async (): Promise<Card[]> => {
	const data = cardListSchema.parse(await apiClient<unknown>("/CardList/GetCards"))
	if (data.isSuccessful === false) throw new Error(data.message ?? "card list failed")
	return (data.cardList ?? []).map((card) => ({
		id: card.id,
		name: card.name ?? "",
		number: card.number ?? "",
		owner: card.owner ?? "",
		type: card.type ?? "",
		defaultAccountNumber: card.defaultAccountNumber ?? "",
		categoryKey: card.category?.key ?? "",
		categoryName: card.category?.name ?? "",
		services: new Set(
			[...(card.defaultServices ?? []), ...(card.services ?? [])].flatMap((entry) => (entry.isEnabled === true && entry.key ? [entry.key] : [])),
		),
		balances: {available: card.balance ?? null, total: null, blocked: null},
	}))
}

const balanceSchema = z.object({isSuccessful: z.boolean(), message: z.string().nullish(), balance: amount, totalBalance: amount, blockedAmount: amount})

/**
 * A fresh balance from the bank's card system. The bank rate-limits it, so it only runs when the user asks.
 * Throws when the bank could not answer.
 */
export const getCardBalance = async (cardId: number): Promise<CardBalances> => {
	const data = balanceSchema.parse(await apiClient<unknown>(`/CardList/GetCardBalance?userCardId=${cardId}`))
	if (!data.isSuccessful) throw new Error(data.message ?? "card balance failed")
	return {available: data.balance ?? null, total: data.totalBalance ?? null, blocked: data.blockedAmount ?? null}
}

const resultSchema = z.object({isSuccessful: z.boolean(), message: z.string().nullish()})

/**
 * Moves the card `sourceId` to where `destinationId` is: above it when the source was below, below it when the
 * source was above (the server's rule, the same as for accounts). Throws when the server refuses.
 */
export const moveCard = async (sourceId: number, destinationId: number): Promise<void> => {
	const data = resultSchema.parse(
		await apiClient<unknown>("/CardList/UpdatePriority", {
			method: "POST",
			body: JSON.stringify({sourceUserCardId: sourceId, destinationUserCardId: destinationId}),
		}),
	)
	if (!data.isSuccessful) throw new Error(data.message ?? "reorder failed")
}
