import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {getCmsData, inquireHamoonSignature, requestHamoonSignature, TOKEN_TYPE} from "@/features/cheque/api/hamoon"
import type {Recipient} from "@/features/cheque/api/pichak-register"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

/** The bank's codes for the registry's signed functions. */
const SIGN_GUARANTEE_CODE = "276"
const DETERMINE_GUARANTORS_CODE = "279"
/** What the customer reads in the Hamoon app while deciding whether to approve. */
const SIGN_GUARANTEE_TEXT = "امضای ضمانت چک"
const DETERMINE_GUARANTORS_TEXT = "تعیین ضامنین چک"

const text = z.string().nullish()
const base = {isSuccessful: z.boolean().nullish(), message: text, extendedMessage: text}

// ---- Looking a cheque up -------------------------------------------------------------------------

const chequeFields = {
	sayadId: text,
	serialNo: text,
	seriesNo: text,
	fromIban: text,
	amount: z.union([z.string(), z.number()]).nullish(),
	dueDate: text,
	description: text,
	chequeMediaDescription: text,
	chequeTypeDescription: text,
	chequeStatusDescription: text,
	blockStatusDescription: text,
	guaranteeStatusDescription: text,
	lockedDescription: text,
}

/** A cheque as the registry describes it. Descriptions are in the bank's own words. */
export interface GuaranteeCheque {
	sayyadId: string
	serial: string
	series: string
	iban: string
	/** In Rials. */
	amount: number
	/** As the registry writes it ("14050101"). */
	dueDate: string
	description: string
	media: string
	type: string
	status: string
	blocked: string
	guarantee: string
	locked: string
}

const toCheque = (item: {[K in keyof typeof chequeFields]?: unknown}): GuaranteeCheque => ({
	sayyadId: String(item.sayadId ?? ""),
	serial: String(item.serialNo ?? ""),
	series: String(item.seriesNo ?? ""),
	iban: String(item.fromIban ?? ""),
	amount: Number(item.amount ?? 0) || 0,
	dueDate: String(item.dueDate ?? ""),
	description: String(item.description ?? ""),
	media: String(item.chequeMediaDescription ?? ""),
	type: String(item.chequeTypeDescription ?? ""),
	status: String(item.chequeStatusDescription ?? ""),
	blocked: String(item.blockStatusDescription ?? ""),
	guarantee: String(item.guaranteeStatusDescription ?? ""),
	locked: String(item.lockedDescription ?? ""),
})

const guarantorInquirySchema = z.object({
	...base,
	result: z.object({result: z.object({data: z.object({...chequeFields, guarantorAcceptStatusDescription: text, receivers: z.array(z.object({name: text, idCode: text})).nullish()}).nullish()}).nullish()}).nullish(),
})

export interface GuarantorView {
	cheque: GuaranteeCheque
	/** Whether this customer has already answered the request to guarantee, in the bank's words. */
	myAnswer: string
	receivers: {name: string; idCode: string}[]
}

/** The cheque a guarantor is asked to stand behind. */
export const getGuarantorView = async (sayyadId: string): Promise<GuarantorView> => {
	const data = guarantorInquirySchema.parse(camelKeys(await apiClient<unknown>("/Chakad/GuarantorInquiry", {method: "POST", body: JSON.stringify({sayyadId})})))
	const info = data.result?.result?.data
	if (data.isSuccessful === false || !info) throw new Error(data.extendedMessage ?? data.message ?? "")
	return {cheque: toCheque(info), myAnswer: info.guarantorAcceptStatusDescription ?? "", receivers: (info.receivers ?? []).map((item) => ({name: item.name ?? "", idCode: item.idCode ?? ""}))}
}

const guaranteeInquirySchema = z.object({
	...base,
	result: z.object({result: z.object({data: z.object({...chequeFields, guarantors: z.array(z.object({name: text, idCode: text, guarantorAcceptStatusDescription: text, guaranteeDate: text})).nullish()}).nullish()}).nullish()}).nullish(),
})

export interface GuaranteeView {
	cheque: GuaranteeCheque
	guarantors: {name: string; idCode: string; status: string; date: string}[]
}

/** Where a cheque stands on its guarantee: each guarantor and whether they have signed. */
export const getGuaranteeView = async (sayyadId: string): Promise<GuaranteeView> => {
	const data = guaranteeInquirySchema.parse(camelKeys(await apiClient<unknown>("/Chakad/GuaranteeInquiry", {method: "POST", body: JSON.stringify({sayyadId})})))
	const info = data.result?.result?.data
	if (data.isSuccessful === false || !info) throw new Error(data.extendedMessage ?? data.message ?? "")
	return {
		cheque: toCheque(info),
		guarantors: (info.guarantors ?? []).map((item) => ({name: item.name ?? "", idCode: item.idCode ?? "", status: item.guarantorAcceptStatusDescription ?? "", date: item.guaranteeDate ?? ""})),
	}
}

// ---- Asking for, and stopping, a guarantee --------------------------------------------------------------

/** The holder asks the guarantors to sign. A real transaction: send once per confirmation, never retry automatically. */
export const requestForGuarantee = (sayyadId: string): Promise<TransactionResult> => apiClient<unknown>("/Chakad/RequestForGuarantee", {method: "POST", body: JSON.stringify({sayyadId})}).then(toTransactionResult)

/** The holder stops the guarantors from signing. A real transaction: send once per confirmation, never retry automatically. */
export const stopGuarantorSigning = (sayyadId: string): Promise<TransactionResult> => apiClient<unknown>("/Chakad/StopGuarantorSigning", {method: "POST", body: JSON.stringify({sayyadId})}).then(toTransactionResult)

// ---- Signing as a guarantor -----------------------------------------------------------------------------

/**
 * Sends the customer a request to approve their guarantee in the Hamoon app. Nothing is recorded yet, so asking again is
 * harmless; the id returned names the approval for signGuarantee.
 */
export const requestGuaranteeApproval = async (sayyadId: string, nationalCode: string): Promise<string> => {
	const cms = await getCmsData(SIGN_GUARANTEE_CODE, {sayyadId, acceptGuarantee: true})
	return requestHamoonSignature(cms.tbsBase64, SIGN_GUARANTEE_TEXT, nationalCode)
}

/**
 * Records the guarantor's answer. Accepting needs the Hamoon approval (the bank fetches the signature with the id);
 * refusing needs none. A real transaction: send once per confirmation, never retry automatically.
 */
export const signGuarantee = (sayyadId: string, accept: boolean, msspTransId: string | null): Promise<TransactionResult> =>
	apiClient<unknown>("/Chakad/GuarantorSign", {
		method: "POST",
		body: JSON.stringify(accept ? {sayyadId, acceptGuarantee: true, msspTransId, signData: {cms: null, tokenType: TOKEN_TYPE}} : {sayyadId, acceptGuarantee: false}),
	}).then(toTransactionResult)

// ---- Naming the guarantors of an issued cheque ---------------------------------------------------------

export interface DeterminationAttempt {
	msspTransId: string
	/** When the request was made; the registry wants it back with the signature. */
	assignDate: string
}

const person = (item: Recipient) => ({name: item.name, idType: item.idType, idCode: item.idCode})

/** Sends the customer a request to approve naming these guarantors in the Hamoon app. Nothing is recorded yet. */
export const requestDeterminationApproval = async (sayyadId: string, guarantors: Recipient[], nationalCode: string): Promise<DeterminationAttempt> => {
	const cms = await getCmsData(DETERMINE_GUARANTORS_CODE, {sayyadId, guarantors: guarantors.map(person)})
	return {msspTransId: await requestHamoonSignature(cms.tbsBase64, DETERMINE_GUARANTORS_TEXT, nationalCode), assignDate: cms.dateTime}
}

export type DeterminationOutcome = {state: "waiting"} | {state: "sent"; result: TransactionResult}

/**
 * Names the guarantors once the customer has approved in the Hamoon app ("waiting" means they have not yet). A real
 * transaction: send once per confirmation, never retry automatically; a thrown error means the answer is unknown.
 */
export const determineGuarantors = async (sayyadId: string, guarantors: Recipient[], attempt: DeterminationAttempt): Promise<DeterminationOutcome> => {
	const signature = await inquireHamoonSignature(attempt.msspTransId)
	if (!signature) return {state: "waiting"}
	const result = await apiClient<unknown>("/Chakad/GuarantorsDetermination", {
		method: "POST",
		body: JSON.stringify({sayyadId, guarantors: guarantors.map(person), assignDate: attempt.assignDate, signData: {cms: signature, tokenType: TOKEN_TYPE, dateTime: attempt.assignDate}}),
	}).then(toTransactionResult)
	return {state: "sent", result}
}
