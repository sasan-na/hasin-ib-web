import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

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

// ---- Registering one ---------------------------------------------------------------------------

const frequenciesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	frequencyItems: z.array(z.object({value: z.number(), title: z.string().nullish()})).nullish(),
})

export interface Frequency {
	/** The bank's code: 1 day, 2 week, 3 month, 4 year. */
	value: number
	title: string
}

/** The repeat units a standing order can use ("every N days/weeks/months/years"). */
export const getFrequencies = async (): Promise<Frequency[]> => {
	const data = frequenciesSchema.parse(camelKeys(await apiClient<unknown>("/RegisterStandingOrder/GetFrequencyTypes")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "frequencies failed")
	return (data.frequencyItems ?? []).map((item) => ({value: item.value, title: item.title ?? String(item.value)}))
}

export interface RegisterStandingOrderRequest {
	sourceAccountNumber: string
	sourcePassword: string | null
	sourcePasswordType: PasswordType
	destinationAccountNumber: string
	destinationOwner: string
	/** "YYYY-MM-DD". */
	startDate: string
	frequencyNo: number
	frequencyType: number
	repeatNo: number
	/** In Rials. */
	amount: number
	description: string
	reasonCode: string
}

/** Sets up a standing order from one of the user's accounts to a Maskan account. A real change: send once per confirmation. */
export const registerStandingOrder = (request: RegisterStandingOrderRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/RegisterStandingOrder/Register", {
		method: "POST",
		body: JSON.stringify({
			sourceAccountInfo: {
				accountNumber: request.sourceAccountNumber,
				...(request.sourcePassword ? {accountPin: request.sourcePassword} : {}),
				passwordType: request.sourcePasswordType,
			},
			// 1: a deposit account at this bank.
			destinationType: 1,
			destinationPan: request.destinationAccountNumber,
			destinationOwner: request.destinationOwner,
			startDate: request.startDate,
			description: request.description,
			frequencyNo: request.frequencyNo,
			frequencyType: request.frequencyType,
			repeatNo: request.repeatNo,
			amount: request.amount,
			reasonCode: request.reasonCode,
		}),
	}).then(toTransactionResult)
