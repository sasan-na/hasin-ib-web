import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	errorCode: z.string().nullish(),
	items: z.array(z.record(z.string(), z.unknown())).nullish(),
})

export type TokenType = "SMS" | "SFT"

/** A card and the one-time-password token it uses for its second password, if any. */
export interface DynamicPasswordCard {
	cardNumber: string
	tokenSerial: string
	/** SMS (a code texted to the phone), SFT (a code made by the bank's app), or empty when the card has none. */
	tokenType: string
	/** The card still has its second password; false means it was blocked and only a branch can restore it. */
	secondPasswordActive: boolean
}

const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "")

/** The user's cards with their one-time-password tokens. The bank answers code 940 when there is nothing to show. */
export const getDynamicPasswordCards = async (): Promise<DynamicPasswordCard[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/Otp/GetList")))
	if (data.isSuccessful === false && data.errorCode !== "940") throw new Error(data.message ?? "dynamic passwords failed")
	return (data.items ?? []).map((item) => ({
		cardNumber: text(item.cardNumber),
		tokenSerial: text(item.tokenSerial),
		tokenType: text(item.tokenType),
		secondPasswordActive: text(item.pin2_Static ?? item.pin2Static) !== "0",
	}))
}

// The bank identifies the phone being verified by these fixed codes (a temporary token for a mobile number).
const PHONE_ENTITY_TYPE = "5910"
const CARD_ENTITY_TYPE = "5909"
const phoneEntity = (mobile: string): string => `00059${mobile}`

/** Texts a verification code to a mobile number. Throws with the bank's text when it refuses (for example too many requests). */
export const sendPhoneCode = async (mobile: string): Promise<void> => {
	const result = toTransactionResult(
		await apiClient<unknown>("/Otp/SendOtpActivationCode", {
			method: "POST",
			body: JSON.stringify({entityNumber: phoneEntity(mobile), entityType: PHONE_ENTITY_TYPE, phoneNumber: mobile, tokenType: "TMP", cardOldTokenRemove: false, customerOldTokenRemove: false, checkCIF: false}),
		}),
	)
	if (!result.ok) throw new Error(result.message)
}

/** Checks the code texted to the mobile number. Throws with the bank's text when it is wrong. */
export const verifyPhoneCode = async (mobile: string, code: string): Promise<void> => {
	const result = toTransactionResult(
		await apiClient<unknown>("/Otp/VerifyOtpActivationCode", {
			method: "POST",
			body: JSON.stringify({password: code, mobileNumber: mobile, entityNumber: phoneEntity(mobile), entityType: PHONE_ENTITY_TYPE, pnn: "2", nps: "0"}),
		}),
	)
	if (!result.ok) throw new Error(result.message)
}

/** Gives a card a one-time-password token tied to a verified phone, replacing its old one. A real change: send once per confirmation. */
export const registerToken = (cardNumber: string, mobile: string, tokenType: TokenType): Promise<TransactionResult> =>
	apiClient<unknown>("/Otp/Register", {
		method: "POST",
		body: JSON.stringify({entityNumber: cardNumber, entityType: CARD_ENTITY_TYPE, phoneNumber: mobile, tokenType, cardOldTokenRemove: true, customerOldTokenRemove: false, checkCIF: true}),
	}).then(toTransactionResult)

/** Blocks a card's second password for good: only a branch can restore it. A real change: send once per confirmation. */
export const blockSecondPassword = (cardNumber: string): Promise<TransactionResult> =>
	apiClient<unknown>("/Otp/BlockPin2", {method: "POST", body: JSON.stringify({pan: cardNumber})}).then(toTransactionResult)
