import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

// ---- Why the money moves ---------------------------------------------------------------------

const reasonsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	list: z.array(z.object({code: z.string(), name: z.string().nullish()})).nullish(),
})

export interface ReasonCode {
	code: string
	name: string
}

/** The reasons the bank lets a transfer be labelled with. */
export const getReasonCodes = async (): Promise<ReasonCode[]> => {
	const data = reasonsSchema.parse(camelKeys(await apiClient<unknown>("/TransferMoney/GetReasonCodes")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "reason codes failed")
	return (data.list ?? []).map((reason) => ({code: reason.code, name: reason.name ?? reason.code}))
}

// ---- Who is on the other end -----------------------------------------------------------------

const summarySchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	accountOwners: z.string().nullish(),
	accountFirstNames: z.string().nullish(),
	accountLastNames: z.string().nullish(),
	accountNumber: z.string().nullish(),
})

export interface AccountOwner {
	number: string
	/** The holder's full name as the bank has it. */
	name: string
	firstName: string
	lastName: string
}

/**
 * Looks up who holds a Maskan account, so the user can check they are paying the right person. Throws with the
 * bank's text when the account cannot be found or may not receive transfers.
 */
export const getAccountOwner = async (accountNumber: string): Promise<AccountOwner> => {
	const data = summarySchema.parse(
		camelKeys(await apiClient<unknown>("/TransferMoney/Internal/GetDestinationSummary", {method: "POST", body: JSON.stringify({destinationAccountNumber: accountNumber})})),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "")
	return {
		number: data.accountNumber ?? accountNumber,
		name: (data.accountOwners ?? "").trim(),
		firstName: (data.accountFirstNames ?? "").trim(),
		lastName: (data.accountLastNames ?? "").trim(),
	}
}

// ---- The transfer itself ---------------------------------------------------------------------

export interface InternalTransferRequest {
	sourceAccountNumber: string
	/** The paying account's password or code; omitted when it needs none. */
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	destination: AccountOwner
	/** In Rials. */
	amount: number
	description: string
	reasonCode: string
}

/**
 * Moves money between two Maskan accounts. A real transaction: send it once per confirmation and never retry
 * automatically. A refusal comes back as `ok: false`.
 */
export const transferInternal = (request: InternalTransferRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/TransferMoney/Internal/DoTransfer", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
			},
			destinationAccountNumber: request.destination.number,
			destinationOwner: request.destination.name,
			destinationFirstName: request.destination.firstName,
			destinationLastName: request.destination.lastName,
			amount: request.amount,
			description: request.description,
			reasonCode: request.reasonCode,
			isRepetitive: false,
		}),
	}).then(toTransactionResult)

// ---- Transfers to another bank (IBAN: Paya and Satna) ---------------------------------------

export type IbanNetwork = "satna" | "paya"

const ibanSummarySchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	owner: z.string().nullish(),
	isWithoutInquiry: z.boolean().nullish(),
})

export interface IbanHolder {
	/** The 24 digits, without "IR". */
	iban: string
	name: string
	firstName: string
	lastName: string
	/** The bank could not look the holder up; the user types the name and the transfer goes without a check. */
	withoutInquiry: boolean
	/** The bank's note about the lookup, when it gave one. */
	note: string
}

/** Looks up who holds an IBAN at another bank. Throws with the bank's text when it may not receive transfers. */
export const getIbanHolder = async (iban: string, network: IbanNetwork): Promise<IbanHolder> => {
	const data = ibanSummarySchema.parse(
		camelKeys(await apiClient<unknown>(`/TransferMoney/Satna/GetIbanSummary?iban=${encodeURIComponent(iban)}&isSatna=${network === "satna"}`)),
	)
	// A failed lookup that the bank still lets through ("without inquiry") answers isSuccessful true with a message.
	if (data.isSuccessful === false) throw new Error(data.message ?? "")
	return {
		iban,
		name: (data.owner ?? "").trim(),
		firstName: (data.firstName ?? "").trim(),
		lastName: (data.lastName ?? "").trim(),
		withoutInquiry: data.isWithoutInquiry === true,
		note: data.message ?? "",
	}
}

const scalarSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), result: z.union([z.string(), z.number()]).nullish()})

const scalar = async (path: string): Promise<number | null> => {
	const data = scalarSchema.parse(camelKeys(await apiClient<unknown>(path)))
	const value = data.isSuccessful === false || data.result == null ? NaN : Number(data.result)
	return Number.isFinite(value) ? value : null
}

export interface IbanLimits {
	/** In Rials; null when the bank does not publish one. */
	min: number | null
	max: number | null
}

/** The smallest and largest amount the bank accepts on this network. Satna has only a largest. */
export const getIbanLimits = async (network: IbanNetwork): Promise<IbanLimits> =>
	network === "paya"
		? {min: await scalar("/PayaTransferMoney/GetMinAmount"), max: await scalar("/PayaTransferMoney/GetMaxAmount")}
		: {min: null, max: await scalar("/TransferMoney/Satna/GetMaxAmount")}

export interface IbanTransferRequest {
	network: IbanNetwork
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	holder: IbanHolder
	/** The name as typed when the bank could not look the holder up. */
	firstName: string
	lastName: string
	bankCode: string
	amount: number
	paymentId: string
	description: string
	reasonCode: string
}

/** Moves money to an account at another bank. A real transaction: send once per confirmation, never retry automatically. */
export const transferIban = (request: IbanTransferRequest): Promise<TransactionResult> =>
	apiClient<unknown>(request.network === "satna" ? "/TransferMoney/Satna/DoTransfer" : "/TransferMoney/Paya/DoTransfer", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
			},
			destinationIban: request.holder.iban,
			destinationFirstName: request.holder.withoutInquiry ? request.firstName : request.holder.firstName,
			destinationLastName: request.holder.withoutInquiry ? request.lastName : request.holder.lastName,
			destinationBank: request.bankCode,
			amount: request.amount,
			paymentId: request.paymentId,
			description: request.description,
			reasonCode: request.reasonCode,
			isRepetitive: false,
			isWithoutInquiry: request.holder.withoutInquiry,
		}),
	}).then(toTransactionResult)

// ---- Group transfer to accounts at this bank --------------------------------------------------

export interface GroupTransferItem {
	destinationAccountNumber: string
	/** In Rials. */
	amount: number
	description: string
}

export interface GroupTransferRequest {
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	items: GroupTransferItem[]
	/** A note for the whole batch. */
	documentDescription: string
}

/** Pays several accounts from one in a single batch. A real transaction: send once per confirmation, never retry automatically. */
export const transferGroup = (request: GroupTransferRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/TransferMoney/InternalBatch/DoTransfer", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
			},
			items: request.items.map((item) => ({
				destinationAccountNumber: item.destinationAccountNumber,
				amount: item.amount,
				description: item.description,
				paymentId: "",
			})),
			documentDescription: request.documentDescription,
			isRepetitive: false,
		}),
	}).then(toTransactionResult)
