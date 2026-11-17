import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"

// What the bank holds about one card. The holder's name and photo come from a separate call, because the bank
// refreshes them from its card system first, which can be slow.

const infoSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	id: z.number().nullish(),
	pan: z.string().nullish(),
	name: z.string().nullish(),
	owners: z.string().nullish(),
	ownerImage: z.string().nullish(),
})

export interface CardInfo {
	number: string
	name: string
}

export const getCardInfo = async (cardId: number): Promise<CardInfo> => {
	const data = infoSchema.parse(await apiClient<unknown>(`/CardInfo/GetCardInfo?userCardId=${cardId}`))
	if (data.isSuccessful === false) throw new Error(data.message ?? "card info failed")
	return {number: data.pan ?? "", name: data.name ?? ""}
}

export interface CardOwner {
	name: string
	/** A photo URL; empty when there is none or the bank hides photos. */
	image: string
}

export const getCardOwner = async (cardId: number): Promise<CardOwner> => {
	const data = infoSchema.parse(await apiClient<unknown>(`/CardInfo/GetCardOwner?userCardId=${cardId}`))
	if (data.isSuccessful === false) throw new Error(data.message ?? "card owner failed")
	return {name: (data.owners ?? "").trim(), image: data.ownerImage ?? ""}
}

const resultSchema = z.object({isSuccessful: z.boolean(), message: z.string().nullish()})

/** Renames the card for this user only (the name is a personal label, not the bank's record). */
export const renameCard = async (cardId: number, name: string): Promise<void> => {
	const data = resultSchema.parse(
		await apiClient<unknown>("/CardInfo/EditCardName", {method: "POST", body: JSON.stringify({userCardId: cardId, name})}),
	)
	if (!data.isSuccessful) throw new Error(data.message ?? "rename failed")
}
