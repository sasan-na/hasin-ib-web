import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"

// The card requests (new card, replacement, gift cards...) the bank has on file for one of the user's accounts.

const giftSchema = z.object({
	totalAmount: z.number().nullish(),
	totalCount: z.number().nullish(),
	accountNumber: z.string().nullish(),
	giftCardList: z.array(z.object({cardCount: z.number().nullish(), cardAmount: z.number().nullish(), totalAmount: z.number().nullish()})).nullish(),
})

const requestsSchema = z.object({
	isSuccessful: z.boolean(),
	message: z.string().nullish(),
	errorCode: z.string().nullish(),
	requests: z
		.array(
			z.object({
				requestDate: z.string().nullish(),
				referenceNumber: z.string().nullish(),
				requestType: z.string().nullish(),
				branch: z.string().nullish(),
				issuingStatus: z.string().nullish(),
				printingStatus: z.string().nullish(),
				isGiftCard: z.boolean().nullish(),
				giftCardDetails: giftSchema.nullish(),
			}),
		)
		.nullish(),
})

export interface GiftCardDetails {
	accountNumber: string
	totalAmount: number
	totalCount: number
	/** One line per face value: how many cards, of what amount, and what they come to. */
	lines: {count: number; amount: number; total: number}[]
}

export interface CardRequest {
	date: string
	/** The number the bank follows the request by. */
	reference: string
	type: string
	branch: string
	issuingStatus: string
	printingStatus: string
	/** Only for gift-card requests. */
	gift: GiftCardDetails | null
}

export interface CardRequestSearch {
	accountNumber: string
	/** Look one request up by its number... */
	requestNumber: string | null
	/** ...or list those between two calendar dates ("YYYY-MM-DD"). */
	from: string | null
	to: string | null
}

/** The card requests that match the search. An empty list is a normal answer; a refusal throws with the bank's text. */
export const getCardRequests = async (search: CardRequestSearch): Promise<CardRequest[]> => {
	// The server reads these as moments in time and shifts them by its own offset, so a UTC midnight lands on the
	// intended day for any zone east of Greenwich (the bank's).
	const body = {
		accountNumber: search.accountNumber,
		requestNumber: search.requestNumber ?? "",
		startDate: search.from ? `${search.from}T00:00:00Z` : null,
		endDate: search.to ? `${search.to}T00:00:00Z` : null,
	}
	const data = requestsSchema.parse(await apiClient<unknown>("/CardRequestList/GetRequests", {method: "POST", body: JSON.stringify(body)}))
	if (!data.isSuccessful) throw new Error(data.message ?? "")
	return (data.requests ?? []).map((request) => ({
		date: request.requestDate ?? "",
		reference: request.referenceNumber ?? "",
		type: request.requestType ?? "",
		branch: request.branch ?? "",
		issuingStatus: request.issuingStatus ?? "",
		printingStatus: request.printingStatus ?? "",
		gift:
			request.isGiftCard === true && request.giftCardDetails
				? {
						accountNumber: request.giftCardDetails.accountNumber ?? "",
						totalAmount: request.giftCardDetails.totalAmount ?? 0,
						totalCount: request.giftCardDetails.totalCount ?? 0,
						lines: (request.giftCardDetails.giftCardList ?? []).map((line) => ({
							count: line.cardCount ?? 0,
							amount: line.cardAmount ?? 0,
							total: line.totalAmount ?? 0,
						})),
					}
				: null,
	}))
}
