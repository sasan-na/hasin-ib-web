import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"
import type {Recipient} from "@/features/cheque/api/pichak-register"

// The bank forwards the central registry's answer as it is, so every field may be a string or a number.
const text = z.union([z.string(), z.number()]).nullish()
const str = (value: string | number | null | undefined): string => (value === null || value === undefined ? "" : String(value))

/** The registry writes dates as YYYYMMDD; people read YYYY/MM/DD. Anything else is shown as it came. */
const date = (value: string | number | null | undefined): string => {
	const text = str(value)
	return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}/${text.slice(4, 6)}/${text.slice(6)}` : text
}

const personSchema = z.object({name: text, idType: text, idCode: text})

const detailSchema = z.object({
	seriNo: text,
	serialNo: text,
	iban: text,
	amount: text,
	dueDate: text,
	issueDate: text,
	description: text,
	bankCode: text,
	bankName: text,
	branchCode: text,
	branchName: text,
	chequeType: text,
	chequeMedia: text,
	chequeStatus: text,
	guaranteeStatus: text,
	chequeBlock: text,
	reasonCodeStr: text,
	wsrecieverInquiryType: z.array(personSchema).nullish(),
	wssignerInquiryType: z.array(personSchema).nullish(),
	transferRecieverInquiryType: z.array(z.object({name: text, idType: text, idCode: text, acceptTransfer: text, lastActionDateStr: text})).nullish(),
})

const ownerSchema = z.object({
	result: z
		.object({
			data: z
				.object({
					onGoing: text,
					blocked: text,
					ownersInfo: z.array(z.object({idCode: text, idType: text, bounced: text, cleared: text})).nullish(),
				})
				.nullish(),
		})
		.nullish(),
})

const responseSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	response: detailSchema.nullish(),
	ownerInquiryResult: ownerSchema.nullish(),
})

export interface PichakPerson {
	name: string
	/** 1 real, 2 legal, 3 real foreigner, 4 legal foreigner. */
	idType: string
	idCode: string
}

export interface PichakCheque {
	series: string
	serial: string
	iban: string
	/** In Rials. */
	amount: string
	dueDate: string
	issueDate: string
	description: string
	bank: string
	branch: string
	/** The registry's codes; the page turns them into words. */
	chequeType: string
	media: string
	status: string
	guaranteeStatus: string
	block: string
	reason: string
	receivers: PichakPerson[]
	signers: PichakPerson[]
}

/** What the registry knows about the drawer, counted per owner of the cheque. */
export interface OwnerRecord {
	idCode: string
	idType: string
	bounced: string
	cleared: string
}

/** Where a cheque being passed on stands with one of its new receivers. */
export interface TransferReceiver {
	name: string
	idType: string
	idCode: string
	/** 0 no action yet, 1 rejected, 2 accepted, 3 in progress. */
	accepted: string
	lastAction: string
}

export interface PichakInquiry {
	cheque: PichakCheque | null
	transferReceivers: TransferReceiver[]
	ongoing: string
	blocked: string
	owners: OwnerRecord[]
}

export type InquiryRole = "issuer" | "holder"

const people = (list: {name?: string | number | null; idType?: string | number | null; idCode?: string | number | null}[] | null | undefined): PichakPerson[] =>
	(list ?? []).map((person) => ({name: str(person.name), idType: str(person.idType), idCode: str(person.idCode)}))

const toInquiry = (data: z.infer<typeof responseSchema>): PichakInquiry => {
	if (data.isSuccessful === false || !data.response) throw new Error(typeof data.message === "string" ? data.message : "")
	const detail = data.response
	const owner = data.ownerInquiryResult?.result?.data
	return {
		cheque: {
			series: str(detail.seriNo),
			serial: str(detail.serialNo),
			iban: str(detail.iban),
			amount: str(detail.amount),
			dueDate: date(detail.dueDate),
			issueDate: date(detail.issueDate),
			description: str(detail.description),
			bank: [str(detail.bankName), str(detail.bankCode)].filter(Boolean).join(" · "),
			branch: [str(detail.branchName), str(detail.branchCode)].filter(Boolean).join(" · "),
			chequeType: str(detail.chequeType),
			media: str(detail.chequeMedia),
			status: str(detail.chequeStatus),
			guaranteeStatus: str(detail.guaranteeStatus),
			block: str(detail.chequeBlock),
			reason: str(detail.reasonCodeStr),
			receivers: people(detail.wsrecieverInquiryType),
			signers: people(detail.wssignerInquiryType),
		},
		transferReceivers: (detail.transferRecieverInquiryType ?? []).map((receiver) => ({
			name: str(receiver.name),
			idType: str(receiver.idType),
			idCode: str(receiver.idCode),
			accepted: str(receiver.acceptTransfer),
			lastAction: str(receiver.lastActionDateStr),
		})),
		ongoing: str(owner?.onGoing),
		blocked: str(owner?.blocked),
		owners: (owner?.ownersInfo ?? []).map((info) => ({idCode: str(info.idCode), idType: str(info.idType), bounced: str(info.bounced), cleared: str(info.cleared)})),
	}
}

/**
 * Asks the central cheque registry (through the bank) about a cheque by its 16-digit Sayyad id. As the drawer
 * ("issuer") you see your own cheque; as the holder you see one you were given. With `ownerCheck` the holder
 * inquiry also returns how many cheques the drawer has bounced and cleared. Throws with the bank's text on a refusal.
 */
export const inquirePichak = async (sayyadId: string, role: InquiryRole, ownerCheck: boolean): Promise<PichakInquiry> => {
	const body = role === "issuer" ? {sayyadId} : {sayyadId, needOwnerInquiry: ownerCheck}
	return toInquiry(responseSchema.parse(camelKeys(await apiClient<unknown>(role === "issuer" ? "/Pichak/IssuerInquiry" : "/Pichak/HolderInquiry", {method: "POST", body: JSON.stringify(body)}))))
}

/** Where a cheque that is being passed on stands with each of its new receivers. */
export const inquireTransfer = async (sayyadId: string): Promise<PichakInquiry> =>
	toInquiry(responseSchema.parse(camelKeys(await apiClient<unknown>("/Pichak/TransferInquiry", {method: "POST", body: JSON.stringify({sayyadId})}))))

/** The registry's status of a cheque that waits for the receiver to accept it (written, or being passed on to them). */
export const WAITING_FOR_RECEIVER = ["7", "8"]

/** Accepts or rejects a cheque waiting for you. A real transaction: send once per confirmation, never retry automatically. */
export const confirmPichakCheque = (params: {sayyadId: string; accept: boolean; description: string; series: string; serial: string; dueDate: string; amount: number}): Promise<TransactionResult> =>
	apiClient<unknown>("/Pichak/ConfirmCheque", {
		method: "POST",
		body: JSON.stringify({
			sayyadId: params.sayyadId,
			requestType: params.accept ? 1 : 0,
			description: params.description,
			seriesNo: params.series,
			serialNo: params.serial,
			// Back to the registry's own YYYYMMDD form.
			dueDate: params.dueDate.replace(/\D/g, ""),
			amount: params.amount,
		}),
	}).then(toTransactionResult)

/** The registry's status of a cheque that its holder may pass on: registered and accepted. */
export const TRANSFERABLE = ["1"]

/** Passes a cheque you hold on to other people. A real transaction: send once per confirmation, never retry automatically. */
export const transferPichakCheque = (params: {sayyadId: string; description: string; iban: string; recipients: Recipient[]; series: string; serial: string; dueDate: string; amount: number}): Promise<TransactionResult> =>
	apiClient<unknown>("/Pichak/TransferCheque", {
		method: "POST",
		body: JSON.stringify({
			sayyadId: params.sayyadId,
			description: params.description,
			toIban: params.iban === "" ? "" : `IR${params.iban}`,
			persons: params.recipients.map((person) => ({name: person.name, idType: String(person.idType), idCode: person.idCode})),
			seriesNo: params.series,
			serialNo: params.serial,
			dueDate: params.dueDate.replace(/\D/g, ""),
			amount: params.amount,
		}),
	}).then(toTransactionResult)
