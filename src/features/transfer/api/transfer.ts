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
