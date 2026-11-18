import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import type {Recipient} from "@/features/cheque/api/pichak-register"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

/**
 * The code of the bank's own branch that handles cashing, which the registry wants with every lock and unlock. The Indra
 * app sends this same fixed value; it is not something a customer chooses.
 */
const CASHIER_BRANCH_CODE = "1409999"

const text = z.string().nullish()

const schema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	extendedMessage: text,
	result: z
		.object({
			result: z
				.object({
					data: z
						.object({
							sayadId: text,
							serialNo: text,
							seriesNo: text,
							fromIban: text,
							amount: z.union([z.number(), z.string()]).nullish(),
							dueDate: text,
							description: text,
							chequeType: z.number().nullish(),
							chequeMedia: z.number().nullish(),
							locked: z.number().nullish(),
							chequeStatusDescription: text,
							chequeTypeDescription: text,
							chequeMediaDescription: text,
							blockStatusDescription: text,
							guaranteeStatusDescription: text,
							lockedDescription: text,
							holders: z.array(z.object({idCode: text, idType: z.number().nullish(), name: text})).nullish(),
						})
						.nullish(),
				})
				.nullish(),
		})
		.nullish(),
})

/** A cheque as its holder sees it, with what a lock, unlock or clearing needs from the registry. */
export interface HeldCheque {
	sayyadId: string
	serial: string
	series: string
	iban: string
	/** In Rials. */
	amount: number
	/** As the registry writes it ("14050101"). */
	dueDate: string
	description: string
	chequeType: number
	chequeMedia: number
	/** True while the cheque is locked for cashing. */
	locked: boolean
	status: string
	type: string
	media: string
	blocked: string
	guarantee: string
	lockText: string
	holders: {idType: number; idCode: string; name: string}[]
}

/** Looks a cheque up as its holder. Throws with the registry's text when it cannot be found. */
export const getHeldCheque = async (sayyadId: string): Promise<HeldCheque> => {
	const data = schema.parse(camelKeys(await apiClient<unknown>("/Chakad/HolderInquiry", {method: "POST", body: JSON.stringify({sayyadId})})))
	const info = data.result?.result?.data
	if (data.isSuccessful === false || !info) throw new Error(data.extendedMessage ?? data.message ?? "")
	return {
		sayyadId: info.sayadId ?? sayyadId,
		serial: info.serialNo ?? "",
		series: info.seriesNo ?? "",
		iban: info.fromIban ?? "",
		amount: Number(info.amount ?? 0) || 0,
		dueDate: info.dueDate ?? "",
		description: info.description ?? "",
		chequeType: info.chequeType ?? 0,
		chequeMedia: info.chequeMedia ?? 0,
		locked: info.locked === 1,
		status: info.chequeStatusDescription ?? "",
		type: info.chequeTypeDescription ?? "",
		media: info.chequeMediaDescription ?? "",
		blocked: info.blockStatusDescription ?? "",
		guarantee: info.guaranteeStatusDescription ?? "",
		lockText: info.lockedDescription ?? "",
		holders: (info.holders ?? []).map((holder) => ({idType: holder.idType ?? 1, idCode: holder.idCode ?? "", name: holder.name ?? ""})),
	}
}

const holders = (cheque: HeldCheque) => cheque.holders.map((holder) => ({idType: holder.idType, idCode: holder.idCode}))

/**
 * Locks the cheque so it can be cashed. Says whether it is a bounced cheque ("1") or not ("0"). A real transaction: send once
 * per confirmation, never retry automatically.
 */
export const lockForCashing = (cheque: HeldCheque, bounced: boolean, holderIban: string): Promise<TransactionResult> =>
	apiClient<unknown>("/Chakad/LockChequeForCashing", {
		method: "POST",
		body: JSON.stringify({
			sayyadId: cheque.sayyadId,
			serialNo: cheque.serial,
			cashingAmount: cheque.amount,
			cashingDueDate: cheque.dueDate,
			holderIban: holderIban === "" ? "" : `IR${holderIban}`,
			fromIban: cheque.iban,
			chequeType: String(cheque.chequeType),
			chequeMedia: String(cheque.chequeMedia),
			holders: holders(cheque),
			bounceCheque: bounced ? "1" : "0",
			cashierBranchCode: CASHIER_BRANCH_CODE,
		}),
	}).then(toTransactionResult)

/** Removes the cashing lock. A real transaction: send once per confirmation, never retry automatically. */
export const unlockForCashing = (cheque: HeldCheque): Promise<TransactionResult> =>
	apiClient<unknown>("/Chakad/UnlockChequeForCashing", {
		method: "POST",
		body: JSON.stringify({sayyadId: cheque.sayyadId, holders: holders(cheque), cashierBranchCode: CASHIER_BRANCH_CODE}),
	}).then(toTransactionResult)

/**
 * Cashes the cheque inside the bank: its amount is paid into the holder's account. A real transaction that moves money:
 * send once per confirmation, never retry automatically.
 */
export const clearCheque = (cheque: HeldCheque, holderIban: string, description: string): Promise<TransactionResult> =>
	apiClient<unknown>("/Chakad/ChequeClearing", {
		method: "POST",
		body: JSON.stringify({sayyadId: cheque.sayyadId, cashingAmount: cheque.amount, holderIban: `IR${holderIban}`, description}),
	}).then(toTransactionResult)

const person = (item: Recipient) => ({name: item.name, idType: item.idType, idCode: item.idCode})

/**
 * Passes the cheque on to other people (the holder endorses it). A real transaction: send once per confirmation, never retry
 * automatically.
 */
export const transferDigitalCheque = (cheque: HeldCheque, description: string, iban: string, receivers: Recipient[]): Promise<TransactionResult> =>
	apiClient<unknown>("/Chakad/ChakadTransfer", {
		method: "POST",
		body: JSON.stringify({sayyadId: cheque.sayyadId, description, toIban: iban === "" ? "" : `IR${iban}`, acceptTransfer: true, receivers: receivers.map(person)}),
	}).then(toTransactionResult)

/**
 * Gives the cheque back to the person it came from (the registry calls it "odat"): the same call as a transfer, with the
 * give-back flag and no new receivers. A real transaction: send once per confirmation, never retry automatically.
 */
export const returnDigitalCheque = (cheque: HeldCheque): Promise<TransactionResult> =>
	apiClient<unknown>("/Chakad/ChakadTransfer", {
		method: "POST",
		body: JSON.stringify({sayyadId: cheque.sayyadId, description: cheque.description, acceptTransfer: true, giveBack: 1}),
	}).then(toTransactionResult)
