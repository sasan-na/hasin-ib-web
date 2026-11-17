import {apiClient} from "@/lib/api/client"
import {protectPasswords} from "@/features/auth/lib/password-crypto"
import type {CardCredentials} from "@/features/card/api/card-credentials"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

/**
 * Sets a new PIN (the card's second password) on one of the user's cards. The new PIN travels encrypted under a fresh
 * ticket, the way the bank expects, and the card is proved with its CVV2, expiry and the code the bank texted (sent
 * in the code field of `credentials.pin2`, not as a password). A real change: send once per confirmation, never retry
 * automatically.
 */
export const changeCardPin = async (credentials: CardCredentials, newPin: string): Promise<TransactionResult> => {
	const {ticket, encrypted} = await protectPasswords(newPin)
	return toTransactionResult(
		await apiClient<unknown>("/Card/ChangeCardPIN", {
			method: "POST",
			body: JSON.stringify({
				cardInfo: {pan: credentials.pan, cvv2: credentials.cvv2, expirationDate: `${credentials.expiryYear}${credentials.expiryMonth}`, pin2: "", otpPassword: credentials.pin2, issuer: ""},
				ticket,
				newPIN: encrypted[0],
			}),
		}),
	)
}
