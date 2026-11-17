import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type PasswordType, type TransactionResult} from "@/features/transaction/api/transaction"

const text = z.string().nullish()

// ---- Statuses and series (for the filters) ---------------------------------------------------

const statusSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, chequeStatusList: z.array(z.object({key: z.string(), title: text})).nullish()})

export interface ChequeStatus {
	key: string
	title: string
}

export const getChequeStatuses = async (): Promise<ChequeStatus[]> => {
	const data = statusSchema.parse(camelKeys(await apiClient<unknown>("/Cheque/GetChequeStatusList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "cheque statuses failed")
	return (data.chequeStatusList ?? []).map((status) => ({key: status.key, title: status.title ?? status.key}))
}

const seriesSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, series: z.array(z.string()).nullish(), digitalSeries: z.array(z.string()).nullish()})

export interface ChequeSeries {
	paper: string[]
	digital: string[]
}

/** The series (books) of cheques on an account. The bank answers from the list it fetched earlier, so open the list first. */
export const getChequeSeries = async (accountNumber: string): Promise<ChequeSeries> => {
	const data = seriesSchema.parse(camelKeys(await apiClient<unknown>(`/Cheque/GetChequeSeries?accountNumber=${encodeURIComponent(accountNumber)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "cheque series failed")
	return {paper: data.series ?? [], digital: data.digitalSeries ?? []}
}

// ---- The cheques -----------------------------------------------------------------------------

const chequeSchema = z.object({
	series: text,
	serial: text,
	status: text,
	statusKey: text,
	sayyadId: text,
	chequeExpirationDate: text,
	checkMedia: text,
	hasBlockPermission: z.boolean().nullish(),
	hasHistoryPermission: z.boolean().nullish(),
	hasConfirmPermission: z.boolean().nullish(),
	hasInquiryPermission: z.boolean().nullish(),
	hasRegisterPermission: z.boolean().nullish(),
})

const listSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, showMore: z.boolean().nullish(), cheques: z.array(chequeSchema).nullish()})

export interface Cheque {
	series: string
	serial: string
	status: string
	statusKey: string
	/** The 16-digit national id of a registered (Sayyad) cheque; empty when it has none yet. */
	sayyadId: string
	/** Jalali date. */
	expiry: string
	digital: boolean
	canBlock: boolean
	canSeeHistory: boolean
	/** The bank lets the user confirm the amount of this cheque (the owner telling the bank what it was written for). */
	canConfirmAmount: boolean
	/** The registry can be asked about this cheque (it has a Sayyad id and is in a status that allows it). */
	canInquire: boolean
	/** The cheque is in a status where its drawer may register it in the registry. */
	canRegister: boolean
}

export interface ChequeFilter {
	accountNumber: string
	/** "1" paper, "2" digital. */
	media: "1" | "2"
	statusKey: string
	series: string
	serial: string
}

export interface ChequePage {
	cheques: Cheque[]
	hasMore: boolean
}

/** One page of an account's cheques. The first page (`startIndex` 0) asks the bank afresh; the next ones read what it just fetched. */
export const getCheques = async (filter: ChequeFilter, startIndex: number, count: number): Promise<ChequePage> => {
	const data = listSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Cheque/FilterCheques", {
				method: "POST",
				body: JSON.stringify({
					accountNumber: filter.accountNumber,
					startIndex,
					count,
					statusKey: filter.statusKey,
					series: filter.series,
					serial: filter.serial,
					checkMedia: filter.media,
					clearCache: startIndex === 0,
				}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "cheques failed")
	return {
		hasMore: data.showMore === true,
		cheques: (data.cheques ?? []).map((cheque) => ({
			series: cheque.series ?? "",
			serial: cheque.serial ?? "",
			status: cheque.status ?? "",
			statusKey: cheque.statusKey ?? "",
			sayyadId: cheque.sayyadId ?? "",
			expiry: cheque.chequeExpirationDate ?? "",
			digital: cheque.checkMedia === "2",
			canBlock: cheque.hasBlockPermission === true,
			canSeeHistory: cheque.hasHistoryPermission === true,
			canConfirmAmount: cheque.hasConfirmPermission === true,
			canRegister: cheque.hasRegisterPermission === true && (cheque.sayyadId ?? "") !== "",
			canInquire: cheque.hasInquiryPermission === true && (cheque.sayyadId ?? "") !== "",
		})),
	}
}

// ---- History ---------------------------------------------------------------------------------

const historySchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	history: z.array(z.object({oldChequeStatus: text, newChequeStatus: text, changeDateTime: text, organizationUnitName: text})).nullish(),
})

export interface ChequeHistoryEntry {
	from: string
	to: string
	date: string
	unit: string
}

/** The status changes of one cheque. The bank asks for the account's password here, so a wrong one comes back as a refusal. */
export const getChequeHistory = async (params: {accountNumber: string; password: string | null; passwordType: PasswordType; series: string; serial: string}): Promise<ChequeHistoryEntry[]> => {
	const data = historySchema.parse(
		camelKeys(
			await apiClient<unknown>("/Cheque/GetChequeHistory", {
				method: "POST",
				body: JSON.stringify({
					accountInfo: {accountNumber: params.accountNumber, ...(params.password ? {accountPin: params.password} : {}), passwordType: params.passwordType},
					series: params.series,
					serial: params.serial,
				}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "")
	return (data.history ?? []).map((entry) => ({from: entry.oldChequeStatus ?? "", to: entry.newChequeStatus ?? "", date: entry.changeDateTime ?? "", unit: entry.organizationUnitName ?? ""}))
}

// ---- Blocking --------------------------------------------------------------------------------

/** Blocks a cheque so it cannot be cashed. A real transaction: send once per confirmation, never retry automatically. */
export const blockCheque = (params: {accountNumber: string; password: string | null; passwordType: PasswordType; series: string; serial: string}): Promise<TransactionResult> =>
	apiClient<unknown>("/BlockCheque/DoTransaction", {
		method: "POST",
		body: JSON.stringify({
			series: params.series,
			serial: params.serial,
			sourceAccountInfo: {accountNumber: params.accountNumber, ...(params.password ? {accountPin: params.password} : {}), passwordType: params.passwordType},
		}),
	}).then(toTransactionResult)

// ---- Confirming the amount -------------------------------------------------------------------

/** Tells the bank the amount a cheque was written for. A real transaction: send once per confirmation, never retry automatically. */
export const confirmChequeAmount = (params: {accountNumber: string; password: string | null; passwordType: PasswordType; series: string; serial: string; amount: number}): Promise<TransactionResult> =>
	apiClient<unknown>("/ChequeAmountConfirm/DoTransaction", {
		method: "POST",
		body: JSON.stringify({
			series: params.series,
			serial: params.serial,
			amount: params.amount,
			sourceAccountInfo: {accountNumber: params.accountNumber, ...(params.password ? {accountPin: params.password} : {}), passwordType: params.passwordType},
		}),
	}).then(toTransactionResult)
