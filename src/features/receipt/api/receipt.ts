import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.union([z.string(), z.number()]).nullish()
const cell = (value: string | number | null | undefined): string => (value === null || value === undefined ? "" : String(value).trim())

const typesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	transactionTypes: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish(),
})

export interface ReceiptType {
	id: number
	name: string
}

/** The kinds of transaction that have a receipt. */
export const getReceiptTypes = async (): Promise<ReceiptType[]> => {
	const data = typesSchema.parse(camelKeys(await apiClient<unknown>("/Receipt/GetTransactionTypes")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "receipt types failed")
	return (data.transactionTypes ?? []).map((type) => ({id: type.id, name: type.name ?? String(type.id)}))
}

const datesSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), fromDate: z.string().nullish(), toDate: z.string().nullish()})

/** How far back the bank lets receipts be searched by default: the first and last day as calendar dates ("YYYY-MM-DD"). */
export const getReceiptDates = async (): Promise<{from: string; to: string}> => {
	const data = datesSchema.parse(camelKeys(await apiClient<unknown>("/Receipt/GetDateDefaultValues")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "receipt dates failed")
	return {from: (data.fromDate ?? "").slice(0, 10), to: (data.toDate ?? "").slice(0, 10)}
}

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	totalCount: z.number().nullish(),
	receipts: z
		.array(
			z.object({
				id: z.number(),
				transactionType: z.string().nullish(),
				transactionTypeString: z.string().nullish(),
				dateTime: z.string().nullish(),
				retrievalReferenceNumber: z.string().nullish(),
				batchId: z.string().nullish(),
				isBatch: z.boolean().nullish(),
			}),
		)
		.nullish(),
})

export interface ReceiptFilter {
	/** The id of a kind of transaction, or empty for all. */
	typeId: string
	/** "YYYY-MM-DD". */
	from: string
	to: string
	reference: string
}

export interface ReceiptRow {
	id: number
	/** The kind, written in the UI language. */
	type: string
	/** The bank's name of the kind, needed to ask for the receipt. */
	typeKey: string
	dateTime: string
	reference: string
	batchId: string
	isBatch: boolean
}

export interface ReceiptPage {
	rows: ReceiptRow[]
	total: number
}

/** One page of the user's receipts, newest first. */
export const getReceipts = async (filter: ReceiptFilter, startIndex: number): Promise<ReceiptPage> => {
	const params = new URLSearchParams({startIndex: String(startIndex)})
	if (filter.typeId !== "") params.set("transactionType", filter.typeId)
	if (filter.from !== "") params.set("fromDate", `${filter.from}T00:00:00`)
	if (filter.to !== "") params.set("toDate", `${filter.to}T23:59:59`)
	if (filter.reference !== "") params.set("retrievalReferenceNumber", filter.reference)
	const data = listSchema.parse(camelKeys(await apiClient<unknown>(`/Receipt?${params.toString()}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "receipts failed")
	return {
		total: data.totalCount ?? 0,
		rows: (data.receipts ?? []).map((row) => ({
			id: row.id,
			type: row.transactionType ?? "",
			typeKey: row.transactionTypeString ?? "",
			dateTime: row.dateTime ?? "",
			reference: row.retrievalReferenceNumber ?? "",
			batchId: row.batchId ?? "",
			isBatch: row.isBatch === true,
		})),
	}
}

const field = z.object({label: z.string().nullish(), value: text, type: z.string().nullish(), key: z.string().nullish()})

const detailsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	description: z.string().nullish(),
	keyValues: z.array(field).nullish(),
	moreDetails: z.array(field).nullish(),
	batchDetails: z
		.object({
			batchMoreDetails: z.string().nullish(),
			headers: z.array(z.object({header: z.string().nullish(), type: z.string().nullish()})).nullish(),
			rows: z.array(z.object({isSuccessful: z.boolean().nullish(), values: z.array(text).nullish()})).nullish(),
		})
		.nullish(),
})

export interface ReceiptField {
	label: string
	value: string
	/** How to show the value: String, DateTime, Amount, CardPan, LeftAlign or Iban. */
	type: string
}

export interface Receipt {
	description: string
	fields: ReceiptField[]
	/** Longer notes, each shown folded under its label. */
	notes: ReceiptField[]
	batch: {title: string; headers: {label: string; type: string}[]; rows: {ok: boolean; values: string[]}[]} | null
}

const toField = (item: z.infer<typeof field>): ReceiptField => ({label: item.label ?? "", value: cell(item.value), type: item.type ?? "String"})

/** The receipt of one transaction (or one group transfer). */
export const getReceipt = async (row: Pick<ReceiptRow, "id" | "typeKey" | "batchId" | "isBatch">): Promise<Receipt> => {
	const params = new URLSearchParams({txId: String(row.id), isBatch: String(row.isBatch), shouldBeSuccessful: "false", hasWorkflow: "false"})
	if (row.batchId !== "") params.set("batchId", row.batchId)
	const data = detailsSchema.parse(camelKeys(await apiClient<unknown>(`/${encodeURIComponent(row.typeKey)}/GetReceiptDetails?${params.toString()}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "receipt failed")
	return {
		description: data.description ?? "",
		fields: (data.keyValues ?? []).map(toField),
		notes: (data.moreDetails ?? []).map(toField),
		batch: data.batchDetails
			? {
					title: data.batchDetails.batchMoreDetails ?? "",
					headers: (data.batchDetails.headers ?? []).map((header) => ({label: header.header ?? "", type: header.type ?? "String"})),
					rows: (data.batchDetails.rows ?? []).map((row) => ({ok: row.isSuccessful !== false, values: (row.values ?? []).map(cell)})),
				}
			: null,
	}
}
