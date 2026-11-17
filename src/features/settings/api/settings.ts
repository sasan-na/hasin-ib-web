import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

// ---- Which accounts, cards and loans are shown ---------------------------------------------------

const displaySchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	items: z
		.array(z.object({id: z.number(), type: z.string().nullish(), typeName: z.string().nullish(), name: z.string().nullish(), accountNumber: z.string().nullish(), cardNumber: z.string().nullish(), iBan: z.string().nullish(), show: z.boolean().nullish()}))
		.nullish(),
})

export type DisplayKind = "account" | "card" | "loan"

/** An account, card or loan the user may choose to show in, or hide from, the bank's lists. */
export interface DisplayItem {
	id: number
	kind: DisplayKind
	name: string
	typeName: string
	accountNumber: string
	cardNumber: string
	iban: string
	shown: boolean
}

const kindOf = (type: string | null | undefined): DisplayKind => ((type ?? "").toLowerCase() === "card" ? "card" : (type ?? "").toLowerCase() === "loan" ? "loan" : "account")

export const getDisplayItems = async (): Promise<DisplayItem[]> => {
	const data = displaySchema.parse(camelKeys(await apiClient<unknown>("/CardAccountDisplay/List")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "display list failed")
	return (data.items ?? []).map((item) => ({
		id: item.id,
		kind: kindOf(item.type),
		name: item.name ?? "",
		typeName: item.typeName ?? "",
		accountNumber: item.accountNumber ?? "",
		cardNumber: item.cardNumber ?? "",
		iban: item.iBan ?? "",
		shown: item.show !== false,
	}))
}

const answerSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish()})

const post = async (path: string, body: unknown): Promise<void> => {
	const data = answerSchema.parse(camelKeys(await apiClient<unknown>(path, {method: "POST", body: JSON.stringify(body)})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "display change failed")
}

/**
 * Shows or hides one item. A loan is kept on an account or a card, and the bank does not say which, so both are asked
 * and the loan is hidden or shown when either accepts. A real change: send once per confirmation.
 */
export const setDisplay = async (item: DisplayItem, show: boolean): Promise<void> => {
	const account = () => post(show ? "/CardAccountDisplay/AccountEnable" : "/CardAccountDisplay/AccountDisable", {accountNumber: item.accountNumber})
	const card = () => post(show ? "/CardAccountDisplay/CardEnable" : "/CardAccountDisplay/CardDisable", {pan: item.cardNumber})
	if (item.kind === "account") return account()
	if (item.kind === "card") return card()
	try {
		await account()
	} catch {
		await card()
	}
}

// ---- Where the user may sign in from ----------------------------------------------------------------

const limitationsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	items: z.array(z.object({type: z.string().nullish(), details: z.string().nullish(), limitationType: z.union([z.number(), z.string()]).nullish(), countryCode: z.string().nullish(), fromIp: z.string().nullish(), toIp: z.string().nullish()})).nullish(),
})

/** A rule that limits signing in to a country or an address range. */
export interface Limitation {
	/** 0 is a country, 1 an address range. */
	kind: 0 | 1
	typeName: string
	details: string
	countryCode: string
	fromIp: string
	toIp: string
}

export const getLimitations = async (): Promise<Limitation[]> => {
	const data = limitationsSchema.parse(camelKeys(await apiClient<unknown>("/User/Settings/GetLimitationList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "limitations failed")
	return (data.items ?? []).map((item) => ({
		kind: Number(item.limitationType) === 0 || item.limitationType === "CountryIp" ? 0 : 1,
		typeName: item.type ?? "",
		details: item.details ?? "",
		countryCode: item.countryCode ?? "",
		fromIp: item.fromIp ?? "",
		toIp: item.toIp ?? "",
	}))
}

const countriesSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), countries: z.array(z.object({code: z.string().nullish(), name: z.string().nullish()})).nullish()})

export interface Country {
	code: string
	name: string
}

export const getCountries = async (): Promise<Country[]> => {
	const data = countriesSchema.parse(camelKeys(await apiClient<unknown>("/User/Settings/GetCountries")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "countries failed")
	return (data.countries ?? []).map((country) => ({code: country.code ?? "", name: country.name ?? ""}))
}

/** Allows sign-in only from a country. A real change that can lock the user out: send once per confirmation. */
export const addCountryLimitation = (countryCode: string): Promise<void> => post("/User/Settings/AddCountryIpLimitation", {countryCode})

/** Allows sign-in only from an address range. A real change that can lock the user out: send once per confirmation. */
export const addIpLimitation = (fromIp: string, toIp: string): Promise<void> => post("/User/Settings/AddIpLimitation", {fromIp, toIp})

/** Removes a sign-in rule. A real change: send once per confirmation. */
export const removeLimitation = (limitation: Limitation): Promise<void> =>
	post("/User/Settings/RemoveIpLimitation", {limitationType: limitation.kind, countryCode: limitation.countryCode, fromIp: limitation.fromIp, toIp: limitation.toIp})
