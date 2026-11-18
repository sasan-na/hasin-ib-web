import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"
import type {Recipient} from "@/features/cheque/api/pichak-register"

const base = {isSuccessful: z.boolean().nullish(), message: z.string().nullish(), extendedMessage: z.string().nullish()}

/** The bank's code for the digital cheque issuing signature (the registry's "function code"). */
const ISSUE_FUNCTION_CODE = "273"
/** Which kind of signing token the registry expects: 1 is the Namad token the Hamoon app provides. */
const TOKEN_TYPE = 1
/** What the customer reads in the Hamoon app while deciding whether to approve. */
const HAMOON_TEXT = "صدور چک دیجیتال"
const MSS_URI = "http://mss.isc.co.ir/v1.0/CMS-ATT/NRS-SHA256/DGS/SRJ"

const activatedSchema = z.object({...base, currentCustomer: z.object({isChakadActivated: z.boolean().nullish()}).nullish()})

/** Whether the customer has activated the digital cheque service. Issuing needs it. */
export const getChakadActivated = async (): Promise<boolean> => {
	const data = activatedSchema.parse(camelKeys(await apiClient<unknown>("/Profile/GetUserProfiles")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "profile failed")
	return data.currentCustomer?.isChakadActivated === true
}

export interface IssueRequest {
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	sayyadId: string
	/** The due date as the registry wants it: Persian, digits only ("14050101"). */
	dueDate: string
	/** In Rials. */
	amount: number
	description: string
	/** 24 digits without "IR", or empty. */
	iban: string
	reasonCode: string
	receivers: Recipient[]
	guarantors: Recipient[]
}

const person = (item: Recipient) => ({name: item.name, idType: item.idType, idCode: item.idCode})

/** What the registry signs is built from these fields only; the account and its password stay out of it. */
const signedPart = (request: IssueRequest) => ({
	sayyadId: request.sayyadId,
	dueDate: request.dueDate,
	amount: request.amount,
	description: request.description,
	toIban: request.iban === "" ? "" : `IR${request.iban}`,
	reasonCode: request.reasonCode,
	receivers: request.receivers.map(person),
	guarantors: request.guarantors.map(person),
	signers: [] as unknown[],
})

const cmsSchema = z.object({...base, tbsBase64: z.string().nullish(), requestDateTime: z.string().nullish(), assignDate: z.string().nullish()})
const hamoonSchema = z.object({...base, errorCode: z.string().nullish(), result: z.object({data: z.object({msspTransId: z.string().nullish()}).nullish()}).nullish()})

/**
 * Asks the bank what has to be signed, then asks the Hamoon service to send that to the customer's Hamoon app. The customer
 * approves it there; the id returned names that approval so the bank can fetch the signature itself when issuing.
 * Nothing is issued yet, so asking again (which sends a fresh request to the app) is harmless.
 */
export const requestIssueSignature = async (request: IssueRequest, nationalCode: string): Promise<string> => {
	const cms = cmsSchema.parse(camelKeys(await apiClient<unknown>("/Chakad/GetCmsData", {method: "POST", body: JSON.stringify({functionCode: ISSUE_FUNCTION_CODE, model: signedPart(request)})})))
	if (cms.isSuccessful === false || !cms.tbsBase64) throw new Error(cms.extendedMessage ?? cms.message ?? "")
	const signature = hamoonSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Hamoon/RequestSignature", {
				method: "POST",
				body: JSON.stringify({dataToBeSignedValue: cms.tbsBase64, dataToBeDisplayedValue: HAMOON_TEXT, mssUri: MSS_URI, apTransId: "", owner: nationalCode, holder: nationalCode}),
			}),
		),
	)
	const id = signature.result?.data?.msspTransId
	if (signature.isSuccessful === false || !id) throw new Error(signature.extendedMessage ?? signature.message ?? "")
	return id
}

/**
 * Issues the digital cheque once the customer has approved it in the Hamoon app: the bank looks the signature up with the
 * id. A real transaction: send once per confirmation, never retry automatically.
 */
export const issueChakadCheque = (request: IssueRequest, msspTransId: string): Promise<TransactionResult> =>
	apiClient<unknown>("/Chakad/ChequeIssue", {
		method: "POST",
		body: JSON.stringify({
			...signedPart(request),
			sourceAccountInfo: {accountNumber: request.sourceAccountNumber, ...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}), passwordType: request.sourcePasswordType},
			msspTransId,
			signData: {cms: null, tokenType: TOKEN_TYPE},
		}),
	}).then(toTransactionResult)
