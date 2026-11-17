import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

const typesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	chequeBookTypes: z.array(z.object({key: z.number(), title: z.string().nullish()})).nullish(),
})

export interface ChequeBookType {
	key: number
	title: string
}

/** The kinds of cheque book the bank issues. */
export const getChequeBookTypes = async (): Promise<ChequeBookType[]> => {
	const data = typesSchema.parse(camelKeys(await apiClient<unknown>("/Cheque/GetChequeBookTypes")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "cheque book types failed")
	return (data.chequeBookTypes ?? []).map((type) => ({key: type.key, title: type.title ?? String(type.key)}))
}

export interface ChequeBookRequest {
	accountNumber: string
	password: string | null
	passwordType: PasswordType
	bookType: number
	branchCode: string
}

/** Asks the bank for a cheque book, to be collected at a branch. A real transaction: send once per confirmation, never retry automatically. */
export const requestChequeBook = (request: ChequeBookRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/Cheque/RequestChequeBook", {
		method: "POST",
		body: JSON.stringify({
			accountNumber: request.accountNumber,
			...(request.password ? {accountPin: request.password} : {}),
			passwordType: request.passwordType,
			chequeBookType: request.bookType,
			branchCode: request.branchCode,
		}),
	}).then(toTransactionResult)
