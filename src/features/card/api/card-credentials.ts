import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

// What proves a card transaction is the owner's: the card's password (PIN2, or a code the bank texts), its CVV2 and
// expiry, and a one-time password when the card has a token. These go to the bank with the request and are never
// kept here.

const infoSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	hasOtp: z.boolean().nullish(),
	otpName: z.string().nullish(),
	// Saved by the user earlier, if they chose to (see card details); they only pre-fill the form.
	cvv2: z.string().nullish(),
	expirationYear: z.string().nullish(),
	expirationMonth: z.string().nullish(),
})

export interface CardCredentialInfo {
	/** The card has a token: its one-time password is also required. */
	hasOtp: boolean
	/** What the bank calls that password; empty when there is none. */
	otpName: string
	saved: {cvv2: string; month: string; year: string}
}

export const getCardCredentialInfo = async (cardId: number): Promise<CardCredentialInfo> => {
	const data = infoSchema.parse(await apiClient<unknown>(`/CardInfo/GetCardPasswordInfo?userCardId=${cardId}`))
	if (data.isSuccessful === false) throw new Error(data.message ?? "card password info failed")
	return {
		hasOtp: data.hasOtp === true,
		otpName: data.otpName ?? "",
		saved: {cvv2: data.cvv2 ?? "", month: data.expirationMonth ?? "", year: data.expirationYear ?? ""},
	}
}

/** The secrets as typed (or pre-filled), ready to be sent. */
export interface CardCredentials {
	pan: string
	cvv2: string
	/** Two digits each, as printed on the card. */
	expiryMonth: string
	expiryYear: string
	/** The card password, or the code the bank texted in its place. */
	pin2: string
	otp: string | null
}

/** The `cardInfo` block the bank's card transactions expect. */
export const toCardInfoBody = (credentials: CardCredentials) => ({
	pan: credentials.pan,
	cvv2: credentials.cvv2,
	expirationDate: `${credentials.expiryYear}${credentials.expiryMonth}`,
	pin2: credentials.pin2,
	...(credentials.otp ? {oTPPassword: credentials.otp} : {}),
})

/** Asks the bank to text a one-time code for the card. Resolves with the bank's answer; a refusal is `ok: false`. */
export const requestCardCode = async (credentials: Pick<CardCredentials, "pan" | "cvv2" | "expiryMonth" | "expiryYear">, serviceName: string): Promise<TransactionResult> =>
	toTransactionResult(
		await apiClient<unknown>("/Otp/Harim", {
			method: "POST",
			body: JSON.stringify({
				cardInfo: {pan: credentials.pan, cvv2: credentials.cvv2, expirationDate: `${credentials.expiryYear}${credentials.expiryMonth}`},
				serviceName,
				amount: 0,
			}),
		}),
	)
