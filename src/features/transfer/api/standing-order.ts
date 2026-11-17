import {z} from "@/lib/zod"

import {apiBlob, apiClient} from "@/lib/api/client"
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

const detailsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	sourceAccountNumber: z.string().nullish(),
	destinationAccountNumber: z.string().nullish(),
	destinationName: z.string().nullish(),
	destinationAccountOwner: z.string().nullish(),
	amount: z.number().nullish(),
	totalAmount: z.number().nullish(),
	standingOrderDuration: z.number().nullish(),
	frequency: z.string().nullish(),
	fromDate: z.string().nullish(),
	toDate: z.string().nullish(),
	status: z.string().nullish(),
	reason: z.string().nullish(),
	description: z.string().nullish(),
	history: z
		.array(z.object({trackingCode: z.string().nullish(), specifiedPaymentDate: z.string().nullish(), paymentDate: z.string().nullish(), status: z.string().nullish(), isStatusSuccess: z.boolean().nullish()}))
		.nullish(),
})

export interface StandingOrderKey {
	sourceAccountNumber: string
	destinationNumber: string
	code: string
}

export interface StandingOrderDetails {
	sourceAccountNumber: string
	destinationNumber: string
	destinationName: string
	/** In Rials. */
	amount: number
	/** Paid so far, in Rials. */
	totalPaid: number
	/** How many transfers are planned. */
	duration: number
	frequency: string
	fromDate: string
	toDate: string
	status: string
	reason: string
	description: string
	history: {trackingCode: string; dueDate: string; paidDate: string; status: string; ok: boolean}[]
}

const keyBody = (key: StandingOrderKey): string =>
	JSON.stringify({sourceAccountNumber: key.sourceAccountNumber, destinationAccountNumber: key.destinationNumber, standingOrderCode: key.code})

/** One standing order with the history of its transfers. */
export const getStandingOrderDetails = async (key: StandingOrderKey): Promise<StandingOrderDetails> => {
	const data = detailsSchema.parse(camelKeys(await apiClient<unknown>("/ViewStandingOrderHistory/Details", {method: "POST", body: keyBody(key)})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "standing order details failed")
	return {
		sourceAccountNumber: data.sourceAccountNumber ?? key.sourceAccountNumber,
		destinationNumber: data.destinationAccountNumber ?? key.destinationNumber,
		destinationName: data.destinationName ?? data.destinationAccountOwner ?? "",
		amount: data.amount ?? 0,
		totalPaid: data.totalAmount ?? 0,
		duration: data.standingOrderDuration ?? 0,
		frequency: data.frequency ?? "",
		fromDate: data.fromDate ?? "",
		toDate: data.toDate ?? "",
		status: data.status ?? "",
		reason: data.reason ?? "",
		description: data.description ?? "",
		history: (data.history ?? []).map((item) => ({
			trackingCode: item.trackingCode ?? "",
			dueDate: item.specifiedPaymentDate ?? "",
			paidDate: item.paymentDate ?? "",
			status: item.status ?? "",
			ok: item.isStatusSuccess === true,
		})),
	}
}

/** The standing order and its history as a file; the bank builds it from the details just fetched, so open the details first. */
export const exportStandingOrder = (key: StandingOrderKey, format: "pdf" | "excel"): Promise<Blob> =>
	apiBlob(format === "pdf" ? "/ViewStandingOrderHistory/CreateDetailsPdf" : "/ViewStandingOrderHistory/CreateExcel", {method: "POST", body: keyBody(key)})
