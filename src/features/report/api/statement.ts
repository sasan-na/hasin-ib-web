import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const amount = z.union([z.number(), z.string()]).nullish()

const typesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	statementTypes: z.array(z.object({serviceKey: z.string(), serviceName: z.string().nullish()})).nullish(),
})

export interface StatementType {
	/** The bank's code for the kind of report; sent back as the transaction type. */
	key: string
	name: string
}

/** The kinds of statement the bank offers for one of the user's accounts. */
export const getStatementTypes = async (accountId: number): Promise<StatementType[]> => {
	const data = typesSchema.parse(camelKeys(await apiClient<unknown>(`/Statement/GetAllowedStatementTypes?aocId=${accountId}&isCard=false`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "statement types failed")
	return (data.statementTypes ?? []).map((type) => ({key: type.serviceKey, name: type.serviceName ?? type.serviceKey}))
}

const itemSchema = z.object({
	valueDatePlain: z.string().nullish(),
	valueDate: z.string().nullish(),
	valueTime: z.string().nullish(),
	longDescription: z.string().nullish(),
	shortDescription: z.string().nullish(),
	debitAmount: amount,
	creditAmount: amount,
	balanceAfterTransaction: amount,
	transactionIdentity: z.string().nullish(),
	chequeNo: z.string().nullish(),
	referenceNumber: z.string().nullish(),
})

const statementSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	invoiceCount: z.number().nullish(),
	invoiceItems: z.array(itemSchema).nullish(),
	totalDebitAmount: amount,
	totalCreditAmount: amount,
})

export interface StatementRow {
	/** The bank's own text for the date, in the user's calendar. */
	date: string
	time: string
	description: string
	debit: number | null
	credit: number | null
	balance: number | null
	/** Reference, cheque or tracking numbers worth showing under the description. */
	references: string[]
}

export interface StatementPage {
	rows: StatementRow[]
	/** How many rows the bank has for this search in all. */
	total: number
	totalDebit: number | null
	totalCredit: number | null
}

export interface StatementQuery {
	accountNumber: string
	typeKey: string
	/** Either a period ("YYYY-MM-DD" and the same in the Persian calendar, "YYYY/MM/DD") or the latest N transactions. */
	period: {from: string; to: string; fromJalali: string; toJalali: string} | {latest: number}
	showDebit: boolean
	showCredit: boolean
}

const money = (value: number | string | null | undefined): number | null => {
	if (value === null || value === undefined || value === "") return null
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

/** One page of a statement. `startIndex` is how many rows were already fetched; the first page also clears the bank's cache. */
export const getStatement = async (query: StatementQuery, startIndex: number, pageSize: number): Promise<StatementPage> => {
	const period = query.period
	const range = "from" in period ? period : null
	const latest = "latest" in period ? period.latest : null
	const data = statementSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Statement/GetFilteredStatement", {
				method: "POST",
				body: JSON.stringify({
					clearCache: startIndex === 0,
					isAccountInvoice: true,
					startIndex,
					pageCount: pageSize,
					pan: query.accountNumber,
					count: latest,
					startDate: range?.from ?? null,
					endDate: range?.to ?? null,
					shamsiStartDate: range?.fromJalali ?? null,
					shamsiEndDate: range?.toJalali ?? null,
					transactionType: query.typeKey,
					showDebit: query.showDebit,
					showCredit: query.showCredit,
					stateId: 0,
					orderType: 0,
					bankId: 0,
				}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "statement failed")
	const rows = (data.invoiceItems ?? []).map((item) => ({
		date: item.valueDatePlain ?? item.valueDate ?? "",
		time: item.valueTime ?? "",
		description: item.longDescription ?? item.shortDescription ?? "",
		debit: money(item.debitAmount),
		credit: money(item.creditAmount),
		balance: money(item.balanceAfterTransaction),
		references: [item.transactionIdentity, item.referenceNumber, item.chequeNo].filter((value): value is string => !!value),
	}))
	return {rows, total: data.invoiceCount ?? rows.length, totalDebit: money(data.totalDebitAmount), totalCredit: money(data.totalCreditAmount)}
}
