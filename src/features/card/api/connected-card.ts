import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	result: z.array(z.object({cardNumber: z.string().nullish(), status: z.string().nullish(), expiryDate: z.string().nullish(), balance: z.number().nullish()})).nullish(),
})

/** A backup card connected to one of the user's accounts: it spends from a credit that is kept on the card. */
export interface ConnectedCard {
	number: string
	/** The bank's status letter: "N" is a working card, "C" a closed one. */
	status: string
	expiryDate: string
	/** The credit on the card, in Rials. */
	credit: number
}

/** The cards connected to an account. */
export const getConnectedCards = async (accountNumber: string): Promise<ConnectedCard[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/MultiAccountCard/GetCardList", {method: "POST", body: JSON.stringify({accountNumber})})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "connected cards failed")
	return (data.result ?? []).map((card) => ({number: card.cardNumber ?? "", status: card.status ?? "", expiryDate: card.expiryDate ?? "", credit: card.balance ?? 0}))
}

const balanceSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), result: z.object({creditBalance: z.union([z.string(), z.number()]).nullish()}).nullish()})

/** The credit on one connected card now, in Rials. */
export const getConnectedCardCredit = async (accountNumber: string, pan: string): Promise<number> => {
	const data = balanceSchema.parse(camelKeys(await apiClient<unknown>("/MultiAccountCard/Balance", {method: "POST", body: JSON.stringify({accountNumber, pan})})))
	const value = Number(String(data.result?.creditBalance ?? "").replace(/,/g, ""))
	if (data.isSuccessful === false || !Number.isFinite(value)) throw new Error(data.message ?? "connected card credit failed")
	return value
}

interface Payer {
	accountNumber: string
	password: string | null
	passwordType: PasswordType
}

const source = (payer: Payer) => ({accountNumber: payer.accountNumber, ...(payer.password ? {accountPin: payer.password} : {}), passwordType: payer.passwordType})

export interface CreditRequest extends Payer {
	pan: string
	/** In Rials. */
	amount: number
	/** Take credit back from the card to the account instead of putting it on the card. */
	discharge: boolean
	description: string
}

/** Moves credit between an account and a connected card. A real transaction: send once per confirmation, never retry automatically. */
export const moveCredit = (request: CreditRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/MultiAccountCard/ChargeCredit", {
		method: "POST",
		body: JSON.stringify({sourceAccountInfo: source(request), pan: request.pan, amount: request.amount, discharge: request.discharge, description: request.description}),
	}).then(toTransactionResult)

/** Disconnects cards from an account. A real change: send once per confirmation, never retry automatically. */
export const disconnectCards = (request: Payer & {cards: string[]}): Promise<TransactionResult> =>
	apiClient<unknown>("/MultiAccountCard/Unlink", {method: "POST", body: JSON.stringify({sourceAccountInfo: source(request), cards: request.cards})}).then(toTransactionResult)

const infoSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	result: z
		.object({
			succeed: z.boolean().nullish(),
			errorDescription: z.unknown().nullish(),
			outData: z.object({expiryDate: z.string().nullish(), status: z.string().nullish(), holderName: z.string().nullish(), balance: z.number().nullish()}).nullish(),
		})
		.nullish(),
})

/** What the bank says about a card that could be connected. */
export interface CardToConnect {
	number: string
	holder: string
	expiryDate: string
	status: string
}

/** Looks up a card before connecting it. Nothing is changed. Throws with the bank text when the card cannot be connected. */
export const getCardToConnect = async (accountNumber: string, pan: string): Promise<CardToConnect> => {
	const data = infoSchema.parse(camelKeys(await apiClient<unknown>("/MultiAccountCard/GetCardInfo", {method: "POST", body: JSON.stringify({accountNumber, pan})})))
	const out = data.result?.outData
	if (data.isSuccessful === false || data.result?.succeed === false || !out) throw new Error(data.message ?? (typeof data.result?.errorDescription === "string" ? data.result.errorDescription : "card lookup failed"))
	return {number: pan, holder: out.holderName ?? "", expiryDate: out.expiryDate ?? "", status: out.status ?? ""}
}

/** Connects a card to an account. A real change: send once per confirmation, never retry automatically. */
export const connectCard = (request: Payer & {pan: string}): Promise<TransactionResult> =>
	apiClient<unknown>("/MultiAccountCard/LinkAccountToCard", {method: "POST", body: JSON.stringify({sourceAccountInfo: source(request), pan: request.pan})}).then(toTransactionResult)
