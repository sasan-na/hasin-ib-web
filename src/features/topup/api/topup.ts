import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toCardInfoBody, type CardCredentials} from "@/features/card/api/card-credentials"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

const operatorsSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), operators: z.array(z.object({key: z.string().nullish(), value: z.string().nullish()})).nullish()})

export interface Operator {
	/** What the bank wants back when topping up for this operator. */
	key: string
	name: string
}

/** The mobile operators the bank can top up. */
export const getOperators = async (): Promise<Operator[]> => {
	const data = operatorsSchema.parse(camelKeys(await apiClient<unknown>("/PurchaseVoucher/GetVoucherTypesForTopUp")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "operators failed")
	return (data.operators ?? []).flatMap((item) => (item.key ? [{key: item.key, name: item.value ?? item.key}] : []))
}

const limitsSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), minimumVoucherAmount: z.number().nullish(), maximumVoucherAmount: z.number().nullish(), voucherCoefficient: z.number().nullish()})

/** What the bank allows as a top-up amount, in Rials. */
export interface TopUpLimits {
	min: number
	max: number
	/** An amount must be a multiple of this. */
	step: number
}

export const getTopUpLimits = async (): Promise<TopUpLimits> => {
	const data = limitsSchema.parse(camelKeys(await apiClient<unknown>("/PurchaseVoucher/GetTopUpValidAmounts")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "top-up limits failed")
	return {min: data.minimumVoucherAmount ?? 0, max: data.maximumVoucherAmount ?? 0, step: data.voucherCoefficient ?? 1}
}

export interface TopUpRequest {
	credentials: CardCredentials
	operator: string
	mobile: string
	/** In Rials. */
	amount: number
}

/** Tops up a mobile number from one of the user's cards. A real transaction: send once per confirmation, never retry automatically. */
export const topUp = (request: TopUpRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/PurchaseVoucher/TopUp", {
		method: "POST",
		body: JSON.stringify({cardInfo: toCardInfoBody(request.credentials), voucherType: request.operator, mobileNumber: request.mobile, amount: request.amount, isRepetitive: false}),
	}).then(toTransactionResult)
