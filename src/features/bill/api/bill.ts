import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {toCardInfoBody, type CardCredentials} from "@/features/card/api/card-credentials"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

const text = z.string().nullish()

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	billList: z.array(z.object({id: z.number(), billId: text, mobile: text, title: text})).nullish(),
})

/** A bill the user has paid before and chose to keep in their list. */
export interface SavedBill {
	/** The id of the latest payment; this is what removing the bill needs. */
	id: number
	billId: string
	/** Set for a mobile-operator bill, which is found by phone number. */
	mobile: string
	title: string
}

export const getSavedBills = async (): Promise<SavedBill[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/Bill/GetBills")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "bills failed")
	return (data.billList ?? []).map((bill) => ({id: bill.id, billId: bill.billId ?? "", mobile: bill.mobile ?? "", title: bill.title ?? ""}))
}

const resultSchema = z.object({isSuccessful: z.boolean(), message: text})

/** Takes a bill out of the saved list (the payments themselves stay in the history). */
export const removeSavedBill = async (id: number): Promise<{ok: boolean; message: string}> => {
	const data = resultSchema.parse(camelKeys(await apiClient<unknown>(`/Bill/RemoveBill?id=${String(id)}`)))
	return {ok: data.isSuccessful, message: data.message ?? ""}
}

const mobileSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, billId: text, payId: text, isPaid: z.boolean().nullish()})

export interface MobileBill {
	billId: string
	payId: string
	/** The operator says this bill has already been paid. */
	isPaid: boolean
}

/** Asks the mobile operator for the bill and payment ids of a phone number. */
export const getMobileBill = async (mobile: string): Promise<MobileBill> => {
	const data = mobileSchema.parse(camelKeys(await apiClient<unknown>(`/Bill/GetPayAndBillIdFromMobile?mobile=${encodeURIComponent(mobile)}`)))
	if (data.isSuccessful === false || !data.billId || !data.payId) throw new Error(data.message ?? "")
	return {billId: data.billId, payId: data.payId, isPaid: data.isPaid === true}
}

/** A bill ready to be paid: both ids known and the amount worked out from the payment id. */
export interface PayableBill {
	billId: string
	payId: string
	mobile: string
	/** In Rials. */
	amount: number
	title: string
}

export interface PayBillsRequest {
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	bills: PayableBill[]
	/** Keep the bills in the saved list. */
	remember: boolean
}

/** Pays one or more bills from an account. A real transaction: send once per confirmation, never retry automatically. */
export const payBills = (request: PayBillsRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/Bill/PayAccountBills", {
		method: "POST",
		body: JSON.stringify({
			isShown: request.remember,
			sourceAccountInfo: {
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
			},
			bills: request.bills.map((bill) => ({billId: bill.billId, payId: bill.payId, mobile: bill.mobile, amount: bill.amount, title: bill.title})),
		}),
	}).then(toTransactionResult)

/** Pays one or more bills from a card. A real transaction: send once per confirmation, never retry automatically. */
export const payBillsFromCard = (request: {credentials: CardCredentials; bills: PayableBill[]; remember: boolean}): Promise<TransactionResult> =>
	apiClient<unknown>("/Bill/PayCardBills", {
		method: "POST",
		body: JSON.stringify({
			isShown: request.remember,
			cardInfo: toCardInfoBody(request.credentials),
			bills: request.bills.map((bill) => ({billId: bill.billId, payId: bill.payId, mobile: bill.mobile, amount: bill.amount, title: bill.title})),
		}),
	}).then(toTransactionResult)
