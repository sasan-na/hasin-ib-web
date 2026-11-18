import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

const base = {isSuccessful: z.boolean().nullish(), message: z.string().nullish()}

const configSchema = z.object({intraMaxFileSize: z.number().nullish()})

/** The largest document the bank accepts for in-branch services, in kilobytes (0 when it does not say). */
export const getMaxDocumentKb = async (): Promise<number> => {
	const data = configSchema.parse(camelKeys(await apiClient<unknown>("/TransferMoney/Batch/GetConfigs")))
	return data.intraMaxFileSize ?? 0
}

const destinationsSchema = z.object({...base, result: z.array(z.object({code: z.string().nullish(), name: z.string().nullish()})).nullish()})

export interface DocDestination {
	code: string
	/** What the bank calls the reason; this is also what it wants back. */
	name: string
}

/** The reasons a customer can give for sending documents to the bank. */
export const getDocDestinations = async (): Promise<DocDestination[]> => {
	const data = destinationsSchema.parse(camelKeys(await apiClient<unknown>("/Intra/GetDocDestinations")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "destinations failed")
	return (data.result ?? []).flatMap((item) => (item.name ? [{code: item.code ?? item.name, name: item.name}] : []))
}

const checkSchema = z.object({...base})

/**
 * Asks the bank whether a PDF is a valid, signed document for this customer (and account, for a transfer). Throws with the
 * bank's text when it is not.
 */
export const checkDocument = async (document: string, accountNumber: string | null): Promise<void> => {
	const data = checkSchema.parse(camelKeys(await apiClient<unknown>("/Intra/CheckPDF", {method: "POST", body: JSON.stringify({document, accountNumber})})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "")
}

/** Asks the bank to send documents (a signed PDF) to a branch. A real request: send once per confirmation, never retry automatically. */
export const requestToSendDocuments = (params: {reason: string; branchCode: string; document: string}): Promise<TransactionResult> =>
	apiClient<unknown>("/Intra/RequestToSendDocuments", {method: "POST", body: JSON.stringify({sendingDocReason: params.reason, branchCode: params.branchCode, doc: params.document})}).then(toTransactionResult)

/** Asks a branch for a facility contract. A real request: send once per confirmation, never retry automatically. */
export const requestFacilityContract = (params: {contractNumber: string; branchCode: string}): Promise<TransactionResult> =>
	apiClient<unknown>("/Intra/GetRequestFacilitiesContract", {method: "POST", body: JSON.stringify({facilityContractNumber: params.contractNumber, branchCode: params.branchCode})}).then(toTransactionResult)

/** The bank's numbers for the kinds of transfer. */
export const TRANSFER_TYPE = {internal: 1, satna: 2, paya: 3} as const
export type IntraTransferKind = keyof typeof TRANSFER_TYPE

export interface IntraTransferRequest {
	kind: IntraTransferKind
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	/** An account number for a transfer inside the bank, an IBAN (24 digits, without IR) for another bank. */
	destination: string
	destinationOwner: string
	destinationFirstName: string
	destinationLastName: string
	destinationBank: string
	withoutInquiry: boolean
	/** In Rials. */
	amount: number
	paymentId: string
	description: string
	reasonCode: string
	/** The signed PDF as base64 (no "data:" prefix). */
	document: string
}

/**
 * A transfer that goes through the branch: the same as an ordinary transfer, plus a signed PDF that the bank checks.
 * A real transaction that moves money: send once per confirmation, never retry automatically.
 */
export const intraTransfer = (request: IntraTransferRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/TransferMoney/Intra/DoTransfer", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {accountNumber: request.sourceAccountNumber, ...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}), passwordType: request.sourcePasswordType},
			transferType: TRANSFER_TYPE[request.kind],
			destination: request.destination,
			destinationOwner: request.destinationOwner,
			destinationFirstName: request.destinationFirstName,
			destinationLastName: request.destinationLastName,
			destinationBank: request.destinationBank,
			isWithoutInquiry: request.withoutInquiry,
			amount: request.amount,
			paymentId: request.paymentId,
			description: request.description,
			reasonCode: request.reasonCode,
			isRepetitive: false,
			document: request.document,
		}),
	}).then(toTransactionResult)

export interface IntraBatchItem {
	/** An account number for a transfer inside the bank, an IBAN (24 digits, without IR) for another bank. */
	destination: string
	destinationFirstName: string
	destinationLastName: string
	/** In Rials. */
	amount: number
	paymentId: string
	description: string
	reasonCode: string
}

export interface IntraBatchRequest {
	kind: IntraTransferKind
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	items: IntraBatchItem[]
	/** A note for the whole batch. */
	description: string
	/** The signed PDF as base64 (no "data:" prefix). */
	document: string
}

/**
 * Several transfers at once through the branch, with one signed PDF for the batch. A real transaction that moves money: send
 * once per confirmation, never retry automatically.
 */
export const intraBatchTransfer = (request: IntraBatchRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/TransferMoney/Batch/DoIntraTransfer", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {accountNumber: request.sourceAccountNumber, ...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}), passwordType: request.sourcePasswordType},
			transferType: TRANSFER_TYPE[request.kind],
			items: request.items,
			description: request.description,
			documentDescription: request.description,
			isRepetitive: false,
			document: request.document,
		}),
	}).then(toTransactionResult)

const importItemSchema = z.object({
	accountNumber: z.union([z.string(), z.number()]).nullish(),
	destinationIban: z.string().nullish(),
	destinationFirstName: z.string().nullish(),
	destinationLastName: z.string().nullish(),
	amount: z.union([z.string(), z.number()]).nullish(),
	paymentId: z.union([z.string(), z.number()]).nullish(),
	description: z.string().nullish(),
	reasonCode: z.string().nullish(),
	accountNumberMessage: z.string().nullish(),
	ibanMessage: z.string().nullish(),
	amountMessage: z.string().nullish(),
	paymentIdMessage: z.string().nullish(),
	descriptionMessage: z.string().nullish(),
})

const importSchema = z.object({...base, infoList: z.array(importItemSchema).nullish()})

/** One line of the Excel file, as the bank read it. */
export interface ImportedTransfer {
	/** An account number, or an IBAN without IR. */
	destination: string
	firstName: string
	lastName: string
	/** Digits only; empty when the cell was not a number. */
	amount: string
	paymentId: string
	description: string
	reasonCode: string
	/** What the bank found wrong with the line, if anything. */
	problems: string[]
}

/**
 * Reads the destinations, amounts and descriptions from the bank's Excel template. Nothing is paid; the lines still need their
 * holders found and the document signed.
 */
export const importTransfers = async (kind: IntraTransferKind, file: File): Promise<ImportedTransfer[]> => {
	const body = new FormData()
	body.append("file", file)
	const path = kind === "internal" ? "/TransferMoney/Batch/ImportInternal" : `/TransferMoney/Batch/ImportSatnaPaya?isSatna=${kind === "satna"}`
	const data = importSchema.parse(camelKeys(await apiClient<unknown>(path, {method: "POST", body})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "import failed")
	return (data.infoList ?? []).map((item) => ({
		destination: String(kind === "internal" ? (item.accountNumber ?? "") : (item.destinationIban ?? "")).replace(/\D/g, ""),
		firstName: (item.destinationFirstName ?? "").trim(),
		lastName: (item.destinationLastName ?? "").trim(),
		amount: String(item.amount ?? "").replace(/\D/g, ""),
		paymentId: String(item.paymentId ?? "").replace(/\D/g, ""),
		description: (item.description ?? "").trim(),
		reasonCode: (item.reasonCode ?? "").replace(/\s/g, ""),
		problems: [item.accountNumberMessage, item.ibanMessage, item.amountMessage, item.paymentIdMessage, item.descriptionMessage].filter((message): message is string => !!message),
	}))
}
