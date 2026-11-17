import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toCardInfoBody, type CardCredentials} from "@/features/card/api/card-credentials"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

const holderSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	fullName: z.string().nullish(),
	transferInfo: z.string().nullish(),
	inquiryTransactionId: z.string().nullish(),
})

export interface CardHolder {
	destinationNumber: string
	name: string
	firstName: string
	lastName: string
	/** Opaque text the bank wants echoed back with the transfer. */
	transferInfo: string
	/** Single-use: the transfer is tied to this lookup, so a new transfer needs a new lookup. */
	inquiryId: string
}

/**
 * Looks up who holds the destination card. It needs only the paying card's number (the bank supplies a
 * placeholder password for the lookup). Throws with the bank's text when the card cannot receive money.
 */
export const getCardHolder = async (sourceCardNumber: string, destinationCardNumber: string): Promise<CardHolder> => {
	const data = holderSchema.parse(
		camelKeys(
			await apiClient<unknown>("/CardTransferMoney/GetDestinationOwner", {
				method: "POST",
				body: JSON.stringify({cardInfo: {pan: sourceCardNumber}, destinationPan: destinationCardNumber, forAdd: false}),
			}),
		),
	)
	if (data.isSuccessful === false || !data.inquiryTransactionId) throw new Error(data.message ?? "")
	return {
		destinationNumber: destinationCardNumber,
		name: (data.fullName ?? `${data.firstName ?? ""} ${data.lastName ?? ""}`).trim(),
		firstName: data.firstName ?? "",
		lastName: data.lastName ?? "",
		transferInfo: data.transferInfo ?? "",
		inquiryId: data.inquiryTransactionId,
	}
}

export interface CardTransferRequest {
	credentials: CardCredentials
	holder: CardHolder
	/** In Rials. */
	amount: number
	description: string
	reasonCode: string
}

/** Moves money from the user's card to another card. A real transaction: send once per lookup, never retry automatically. */
export const transferCard = (request: CardTransferRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/CardTransferMoney/DoTransfer", {
		method: "POST",
		body: JSON.stringify({
			cardInfo: toCardInfoBody(request.credentials),
			destinationPan: request.holder.destinationNumber,
			destinationFirstName: request.holder.firstName,
			destinationLastName: request.holder.lastName,
			transferInfo: request.holder.transferInfo,
			inquiryTransactionId: request.holder.inquiryId,
			amount: request.amount,
			description: request.description,
			reasonCode: request.reasonCode,
			isrepetitive: false,
		}),
	}).then(toTransactionResult)
