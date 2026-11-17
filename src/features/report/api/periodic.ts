import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	list: z
		.array(
			z.object({
				periodicInvoiceId: z.number(),
				userAccountId: z.number(),
				interval: z.number(),
				intervalString: text,
				emailAddress: text,
				requestDate: text,
				requestDateString: text,
				language: text,
				accountNumber: text,
				fields: text,
			}),
		)
		.nullish(),
})

/** A statement the bank emails the user on a schedule. */
export interface PeriodicInvoice {
	id: number
	/** The account's id for this user (what the bank asks for, not its number). */
	userAccountId: number
	accountNumber: string
	/** The period code the bank uses; `intervalName` is its wording. */
	interval: number
	intervalName: string
	email: string
	/** The first date it is sent, as the server stores it. */
	firstDate: string
	/** The same date written by the server in the UI language. */
	firstDateText: string
	/** "fa-IR" or "en-US": the language of the emailed statement. */
	language: string
	/** The statement fields included, by key. */
	fields: string[]
}

export const getPeriodicInvoices = async (): Promise<PeriodicInvoice[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/PeriodicInvoice/Get")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "periodic invoices failed")
	return (data.list ?? []).map((item) => ({
		id: item.periodicInvoiceId,
		userAccountId: item.userAccountId,
		accountNumber: item.accountNumber ?? "",
		interval: item.interval,
		intervalName: item.intervalString ?? "",
		email: item.emailAddress ?? "",
		firstDate: item.requestDate ?? "",
		firstDateText: item.requestDateString ?? "",
		language: item.language ?? "",
		fields: (item.fields ?? "").split(";").filter((key) => key !== ""),
	}))
}

// ---- Periods and fields for the form -----------------------------------------------------------

const pairsSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, result: z.array(z.object({key: z.number(), value: text})).nullish()})

export interface Period {
	code: number
	name: string
}

export const getPeriods = async (): Promise<Period[]> => {
	const data = pairsSchema.parse(camelKeys(await apiClient<unknown>("/PeriodicInvoice/GetPeriods")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "periods failed")
	return (data.result ?? []).map((pair) => ({code: pair.key, name: pair.value ?? String(pair.key)}))
}

const fieldsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	statementFields: z.array(z.object({serviceName: text, fields: z.array(z.object({key: z.string(), title: text, isDefault: z.boolean().nullish()})).nullish()})).nullish(),
})

export interface StatementField {
	key: string
	title: string
	/** Included unless the user switches it off. */
	isDefault: boolean
}

/** The columns an account statement can have, for the whole-account statement that periodic invoices use. */
export const getStatementFields = async (): Promise<StatementField[]> => {
	const data = fieldsSchema.parse(camelKeys(await apiClient<unknown>("/Statement/GetStatementFields")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "statement fields failed")
	const group = (data.statementFields ?? []).find((item) => item.serviceName === "AccountTotalStatement")
	return (group?.fields ?? []).map((field) => ({key: field.key, title: field.title ?? field.key, isDefault: field.isDefault === true}))
}

// ---- Saving and removing -----------------------------------------------------------------------

const resultSchema = z.object({isSuccessful: z.boolean(), message: text})

export interface SaveResult {
	ok: boolean
	message: string
}

export interface InvoiceInput {
	/** Set when editing: the invoice being replaced. */
	editing: PeriodicInvoice | null
	userAccountId: number
	interval: number
	email: string
	/** "YYYY-MM-DD" (Gregorian). */
	firstDateIso: string
	language: string
	fields: string[]
}

/** Creates a periodic invoice, or replaces one. A refusal (a duplicate, or no access to the service) comes back as `ok: false`. */
export const savePeriodicInvoice = async (input: InvoiceInput): Promise<SaveResult> => {
	const common = {interval: input.interval, emailAddress: input.email, requestDate: `${input.firstDateIso}T00:00:00Z`, language: input.language, fields: input.fields.join(";")}
	const body = input.editing ? {...common, userAccountId: input.editing.userAccountId, periodicInvoiceId: input.editing.id} : {...common, userAccountId: input.userAccountId}
	const data = resultSchema.parse(camelKeys(await apiClient<unknown>(input.editing ? "/PeriodicInvoice/Edit" : "/PeriodicInvoice/Add", {method: "POST", body: JSON.stringify(body)})))
	return {ok: data.isSuccessful, message: data.message ?? ""}
}

/** Stops a periodic invoice. */
export const removePeriodicInvoice = async (id: number): Promise<SaveResult> => {
	const data = resultSchema.parse(camelKeys(await apiClient<unknown>(`/PeriodicInvoice/Remove?periodicInvoiceId=${String(id)}`)))
	return {ok: data.isSuccessful, message: data.message ?? ""}
}
