import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"

// Pieces shared by every flow that moves money or changes an account: pick a source account, prove who
// you are with its password (or a code sent by SMS), confirm, and read the outcome.

// ---- The outcome of a transaction -------------------------------------------------------------

const transactionResultSchema = z.object({
	isSuccessful: z.boolean(),
	message: z.string().nullish(),
	errorCode: z.string().nullish(),
	transactionId: z.number().nullish(),
	transactionTypeString: z.string().nullish(),
	batchId: z.string().nullish(),
	isBatch: z.boolean().nullish(),
	executionDate: z.string().nullish(),
	hasWorkflow: z.boolean().nullish(),
	workflowShouldBeEdited: z.boolean().nullish(),
})

export interface TransactionResult {
	ok: boolean
	/** The bank's text for the outcome, in the UI language; may be empty. */
	message: string
	errorCode: string
	transactionId: number | null
	/** The bank's key for what was done ("AccountBillPayment"); it names the service that can show the receipt. */
	type: string
	/** Set when the transaction was a group of transfers. */
	batchId: string
	isBatch: boolean
	executedAt: string
	/** The bank is waiting for other signatories before it goes through. */
	needsApproval: boolean
}

/** Reads a transaction answer. A refusal is a normal outcome (`ok: false`), not an exception. */
export const toTransactionResult = (raw: unknown): TransactionResult => {
	const data = transactionResultSchema.parse(raw)
	return {
		ok: data.isSuccessful,
		message: data.message ?? "",
		errorCode: data.errorCode ?? "",
		transactionId: data.transactionId ?? null,
		type: data.transactionTypeString ?? "",
		batchId: data.batchId ?? "",
		isBatch: data.isBatch === true,
		executedAt: data.executionDate ?? "",
		needsApproval: data.hasWorkflow === true,
	}
}

// ---- Which accounts a service may use ---------------------------------------------------------

const sourceAccountSchema = z.object({
	id: z.number(),
	name: z.string().nullish(),
	number: z.string().nullish(),
	balance: z.number().nullish(),
	hasAccessToGetBalance: z.boolean().nullish(),
	accountTypeName: z.string().nullish(),
	allSignatoriesSynced: z.boolean().nullish(),
})

const sourceAccountsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	people: z
		.array(
			z.object({
				name: z.string().nullish(),
				family: z.string().nullish(),
				items: z.array(sourceAccountSchema).nullish(),
			}),
		)
		.nullish(),
})

export interface SourceAccount {
	id: number
	number: string
	name: string
	type: string
	balance: number | null
	/** False when some signatories have not signed in yet, so the bank cannot let this account act. */
	usable: boolean
}

/** The user's own accounts that may be used for `serviceName` (the bank filters by what is enabled). */
export const getSourceAccounts = async (serviceName: string): Promise<SourceAccount[]> => {
	const query = new URLSearchParams({isMine: "true", serviceName, isLoan: "false"})
	const data = sourceAccountsSchema.parse(await apiClient<unknown>(`/AocPicker/GetAccounts?${query.toString()}`))
	if (data.isSuccessful === false) throw new Error(data.message ?? "accounts failed")
	return (data.people ?? []).flatMap((person) =>
		(person.items ?? []).map((account) => ({
			id: account.id,
			number: account.number ?? "",
			name: account.name ?? "",
			type: account.accountTypeName ?? "",
			balance: account.hasAccessToGetBalance === false ? null : (account.balance ?? null),
			usable: account.allSignatoriesSynced !== false,
		})),
	)
}

// ---- How the user proves who they are ---------------------------------------------------------

const configSchema = z.object({
	noPasswordDefaultStateChecked: z.boolean().nullish(),
	noPassLimits: z.array(z.object({serviceName: z.string(), amount: z.number()})).nullish(),
})

export interface TransactionConfig {
	/** Per service: up to this amount an account that has no password needs none for the transaction. */
	noPasswordLimits: Readonly<Record<string, number>>
}

export const getTransactionConfig = async (): Promise<TransactionConfig> => {
	const data = configSchema.parse(await apiClient<unknown>("/TransferMoney/Batch/GetConfigs"))
	return {noPasswordLimits: Object.fromEntries((data.noPassLimits ?? []).map((limit) => [limit.serviceName, limit.amount]))}
}

const passwordInfoSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	// 1 one-time password (token), 2 no password, 3 regular password.
	passwordType: z.number(),
	otpName: z.string().nullish(),
	tokenTypeId: z.number().nullish(),
})

export type PasswordType = 1 | 2 | 3

export interface PasswordInfo {
	type: PasswordType
	/** What the bank calls the code (for example "Dynamic password"); empty for a regular password. */
	codeName: string
	/** Token type 9 is a code the bank texts on request. */
	sendsSmsCode: boolean
}

export const getPasswordInfo = async (accountId: number): Promise<PasswordInfo> => {
	const data = passwordInfoSchema.parse(await apiClient<unknown>(`/PasswordPicker/GetPasswordType?userAccountId=${accountId}`))
	if (data.passwordType !== 1 && data.passwordType !== 2 && data.passwordType !== 3) throw new Error("unknown password type")
	return {
		type: data.passwordType,
		codeName: data.otpName ?? "",
		sendsSmsCode: (data.passwordType === 1 || data.passwordType === 2) && data.tokenTypeId === 9,
	}
}

/** Asks the bank to text the account's one-time code. Resolves with the bank's answer; never throws on a refusal. */
export const requestAccountCode = async (accountNumber: string, serviceName: string, amount: number): Promise<TransactionResult> =>
	toTransactionResult(
		await apiClient<unknown>("/Otp/Harim2", {
			method: "POST",
			body: JSON.stringify({accountInfo: {accountNumber}, serviceName, ...(amount > 0 ? {amount} : {})}),
		}),
	)
