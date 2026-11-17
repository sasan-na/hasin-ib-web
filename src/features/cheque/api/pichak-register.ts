import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

const nameSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), name: z.string().nullish()})

/** The kinds of person or company a cheque can be written to, as the registry numbers them. */
export type PersonType = 1 | 2 | 3 | 4

/**
 * Asks the registry for the name registered to a national id (or company id) for this cheque, so the user does not
 * have to type it and cannot get it wrong. Throws with the registry's text when the id is unknown.
 */
export const getRecipientName = async (params: {sayyadId: string; idType: PersonType; idCode: string}): Promise<string> => {
	const data = nameSchema.parse(camelKeys(await apiClient<unknown>("/Pichak/GetNameInquiry", {method: "POST", body: JSON.stringify({sayyadId: params.sayyadId, idType: String(params.idType), idCode: params.idCode})})))
	if (data.isSuccessful === false || !data.name) throw new Error(data.message ?? "")
	return data.name
}

export interface Recipient {
	name: string
	idType: PersonType
	idCode: string
}

export interface RegisterChequeRequest {
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	series: string
	serial: string
	sayyadId: string
	/** The due date as "YYYY-MM-DD" (Gregorian) and as the user knows it, "YYYY/MM/DD" (Persian). */
	dueDateIso: string
	dueDateJalali: string
	/** In Rials. */
	amount: number
	description: string
	/** 24 digits without "IR", or empty when the cheque is not tied to one account. */
	iban: string
	reasonCode: string
	recipients: Recipient[]
}

/**
 * Registers a cheque you wrote in the central registry, naming who it is payable to. A real transaction: send once per
 * confirmation, never retry automatically.
 */
export const registerCheque = (request: RegisterChequeRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/Pichak/Register", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {accountNumber: request.sourceAccountNumber, ...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}), passwordType: request.sourcePasswordType},
			seriesNo: request.series,
			serialNo: request.serial,
			sayyadId: request.sayyadId,
			// Midnight with no zone: the bank reads it as that day (it adds a day to anything from noon on).
			dueDate: `${request.dueDateIso}T00:00:00`,
			shamsiDueDate: request.dueDateJalali,
			amount: request.amount,
			description: request.description,
			toIban: request.iban === "" ? "" : `IR${request.iban}`,
			reasonCode: request.reasonCode,
			persons: request.recipients.map((person) => ({name: person.name, idType: String(person.idType), idCode: person.idCode})),
		}),
	}).then(toTransactionResult)
