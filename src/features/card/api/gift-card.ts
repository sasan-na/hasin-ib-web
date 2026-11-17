import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

// The bank's limits for gift cards. It sends them as text, so they are read into numbers here.
const configSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	minGiftCardAmount: z.string().nullish(),
	maxGiftCardAmount: z.string().nullish(),
	giftCardMaxQuantity: z.string().nullish(),
	giftCardRatio: z.string().nullish(),
	feeAmount: z.string().nullish(),
})

export interface GiftCardConfig {
	/** The least and most a single card may hold, in Rials. */
	minAmount: number
	maxAmount: number
	/** The most cards in one request. */
	maxQuantity: number
	/** A card's amount must be a multiple of this (Rials). */
	ratio: number
	/** The bank's fee for each card (Rials). */
	fee: number
}

const num = (value: string | null | undefined): number => {
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : 0
}

export const getGiftCardConfig = async (): Promise<GiftCardConfig> => {
	const data = configSchema.parse(camelKeys(await apiClient<unknown>("/RequestGiftCard/GetConfigs")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "gift card config failed")
	return {
		minAmount: num(data.minGiftCardAmount),
		maxAmount: num(data.maxGiftCardAmount),
		maxQuantity: num(data.giftCardMaxQuantity),
		ratio: Math.max(1, num(data.giftCardRatio)),
		fee: num(data.feeAmount),
	}
}

/** One line of the request: `count` cards of `amount` Rials each. */
export interface GiftCardLine {
	amount: number
	count: number
}

export interface GiftCardRequest {
	sourceAccountNumber: string
	/** The paying account's password or code; omitted when it needs none. */
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	branchCode: string
	mobile: string
	lines: GiftCardLine[]
	/** The bank's per-card fee, so each line can carry its own fee and the request the total. */
	fee: number
}

/**
 * Asks the bank to issue gift cards, paid from the account. A real transaction: send it once per confirmation
 * and never retry automatically. A refusal comes back as `ok: false`.
 */
export const requestGiftCards = (request: GiftCardRequest): Promise<TransactionResult> => {
	const cardInfoList = request.lines.map((line) => ({cardAmount: line.amount, cardCount: line.count, feeAmount: request.fee * line.count}))
	// The server recomputes the fee from the card count and refuses the request when this total differs.
	const totalWageAmount = cardInfoList.reduce((sum, line) => sum + line.feeAmount, 0)
	return apiClient<unknown>("/RequestGiftCard/Request", {
		method: "POST",
		body: JSON.stringify({
			accountNumber: request.sourceAccountNumber,
			...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
			passwordType: request.sourcePasswordType,
			branchCode: request.branchCode,
			mobileNumber: request.mobile,
			cardInfoList,
			totalWageAmount,
		}),
	}).then(toTransactionResult)
}
