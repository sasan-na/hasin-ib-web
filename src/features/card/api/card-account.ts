import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

import {toCardInfoBody, type CardCredentials} from "./card-credentials"

// A card draws on one or more accounts; the first is its default. Changing which accounts a card is linked to
// changes what it can spend from, so each change is a transaction the owner proves with the card's secrets.

const accountsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	cardId: z.number().nullish(),
	cardNumber: z.string().nullish(),
	defaultAccountNumber: z.string().nullish(),
	cardAccounts: z
		.array(
			z.object({
				index: z.string().nullish(),
				accountNumber: z.string(),
				accountType: z.string().nullish(),
				accountName: z.string().nullish(),
			}),
		)
		.nullish(),
})

export interface CardAccount {
	/** The bank's position of the account on the card; the default is "1". */
	index: string
	number: string
	type: string
	isDefault: boolean
}

export interface CardAccounts {
	cardNumber: string
	defaultAccountNumber: string
	accounts: CardAccount[]
}

export const getCardAccounts = async (cardId: number): Promise<CardAccounts> => {
	const data = accountsSchema.parse(await apiClient<unknown>("/CardAccountsList/GetList", {method: "POST", body: JSON.stringify({userCardId: cardId})}))
	if (data.isSuccessful === false) throw new Error(data.message ?? "card accounts failed")
	return {
		cardNumber: data.cardNumber ?? "",
		defaultAccountNumber: data.defaultAccountNumber ?? "",
		accounts: (data.cardAccounts ?? []).map((account) => ({
			index: account.index ?? "",
			number: account.accountNumber,
			type: account.accountType ?? account.accountName ?? "",
			isDefault: account.index === "1",
		})),
	}
}

const addableSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	cardNumber: z.string().nullish(),
	accountList: z.array(z.object({accountNumber: z.string()})).nullish(),
})

/** The user's accounts that can still be linked to the card (`linked` are the ones it already has). */
export const getAddableAccounts = async (cardId: number, linked: string[]): Promise<string[]> => {
	const data = addableSchema.parse(
		await apiClient<unknown>("/AddAccountToCard/GetAddableAccount", {
			method: "POST",
			body: JSON.stringify({userCardId: cardId, accountNumbers: linked.join(",")}),
		}),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "addable accounts failed")
	return (data.accountList ?? []).map((account) => account.accountNumber)
}

const post = async (endpoint: string, body: unknown): Promise<TransactionResult> =>
	toTransactionResult(await apiClient<unknown>(endpoint, {method: "POST", body: JSON.stringify(body)}))

/**
 * Unlinks an account from the card. A real change to the card: send it once per confirmation and never retry
 * automatically. A refusal comes back as `ok: false`.
 */
export const disconnectAccount = (request: {account: CardAccount; credentials: CardCredentials}): Promise<TransactionResult> =>
	post("/RemoveAccountFromCard/doTransaction", {
		accountIndex: request.account.index,
		accountNumber: request.account.number,
		cardInfo: toCardInfoBody(request.credentials),
	})

/** Makes another linked account the card's default. Same care as `disconnectAccount`. */
export const changeDefaultAccount = (request: {oldAccountNumber: string; newAccountNumber: string; credentials: CardCredentials}): Promise<TransactionResult> =>
	post("/ChangeDefaultAccount/doTransaction", {
		oldAccountNumber: request.oldAccountNumber,
		newAccountNumber: request.newAccountNumber,
		cardInfo: toCardInfoBody(request.credentials),
	})

/** Links more of the user's accounts to the card. Same care as `disconnectAccount`. */
export const connectAccounts = (request: {accountNumbers: string[]; credentials: CardCredentials}): Promise<TransactionResult> =>
	post("/AddAccountToCard/doTransaction", {accountNumberList: request.accountNumbers, cardInfo: toCardInfoBody(request.credentials)})
