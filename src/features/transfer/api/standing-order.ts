import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

const orderSchema = z.object({
	accountNumber: z.string().nullish(),
	standingOrderCode: z.string().nullish(),
	amount: z.number().nullish(),
	destinationAccountNo: z.string().nullish(),
	destinationAccountOwnerName: z.string().nullish(),
	timeOfTransfer: z.string().nullish(),
	firstDateOfTransfer: z.string().nullish(),
	standingOrderDuration: z.string().nullish(),
	frequency: z.string().nullish(),
	description: z.string().nullish(),
	hasCancelPermission: z.boolean().nullish(),
})

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	infoList: z.array(orderSchema).nullish(),
	totalCount: z.number().nullish(),
})

export interface StandingOrder {
	/** The paying account. */
	sourceAccountNumber: string
	code: string
	amount: number
	destinationNumber: string
	destinationOwner: string
	firstDate: string
	frequency: string
	duration: string
	description: string
	canCancel: boolean
}

export interface StandingOrderList {
	orders: StandingOrder[]
	total: number
}

/** The user's standing orders (regular transfers) across the accounts they may see. */
export const getStandingOrders = async (count: number): Promise<StandingOrderList> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>(`/StandingOrderList/GetList?count=${count}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "standing orders failed")
	const orders = (data.infoList ?? []).map((item) => ({
		sourceAccountNumber: item.accountNumber ?? "",
		code: item.standingOrderCode ?? "",
		amount: item.amount ?? 0,
		destinationNumber: item.destinationAccountNo ?? "",
		destinationOwner: item.destinationAccountOwnerName ?? "",
		firstDate: item.firstDateOfTransfer ?? "",
		frequency: item.frequency ?? "",
		duration: item.standingOrderDuration ?? "",
		description: item.description ?? "",
		canCancel: item.hasCancelPermission !== false,
	}))
	return {orders, total: data.totalCount ?? orders.length}
}

/** Stops a standing order. A real change: send once per confirmation, never retry automatically. */
export const cancelStandingOrder = (order: StandingOrder): Promise<TransactionResult> =>
	apiClient<unknown>("/CancelStandingOrder/Cancel", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountNumber: order.sourceAccountNumber,
			standingOrderCode: order.code,
			destinationAccountNumber: order.destinationNumber,
		}),
	}).then(toTransactionResult)
