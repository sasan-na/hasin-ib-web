import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toCardInfoBody, type CardCredentials} from "@/features/card/api/card-credentials"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

const text = z.string().nullish()
const base = {isSuccessful: z.boolean().nullish(), message: text}

/** The bank's customer type ids: a person, or a company. */
export const NATURAL = 38
export const LEGAL = 39

const provincesSchema = z.object({
	...base,
	provinces: z.array(z.object({id: z.number(), code: z.number(), name: text, cities: z.array(z.object({id: z.number(), code: z.number(), name: text})).nullish()})).nullish(),
})

export interface City {
	code: number
	name: string
}

export interface Province {
	code: number
	name: string
	cities: City[]
}

/** Every province with its cities: where the tag is posted. */
export const getProvinces = async (): Promise<Province[]> => {
	const data = provincesSchema.parse(camelKeys(await apiClient<unknown>("/Etc/GetProvincesCities")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "provinces failed")
	return (data.provinces ?? []).map((province) => ({code: province.code, name: province.name ?? String(province.code), cities: (province.cities ?? []).map((city) => ({code: city.code, name: city.name ?? String(city.code)}))}))
}

const priceSchema = z.object({...base, tagCost: z.number().nullish(), postCost: z.number().nullish(), tehranPostCost: z.number().nullish()})

/** In Rials: one tag, and posting it (inside Tehran province or elsewhere). */
export interface EtcPrice {
	tag: number
	post: number
	tehranPost: number
}

export const getEtcPrice = async (): Promise<EtcPrice> => {
	const data = priceSchema.parse(camelKeys(await apiClient<unknown>("/Etc/GetEtcPrice")))
	if (data.isSuccessful === false || data.tagCost == null) throw new Error(data.message ?? "price failed")
	return {tag: data.tagCost, post: data.postCost ?? 0, tehranPost: data.tehranPostCost ?? 0}
}

const nationalSchema = z.object({...base, result: z.union([z.string(), z.number()]).nullish()})

/** The signed-in user's own national code, to save typing it. */
export const getMyNationalCode = async (): Promise<string> => {
	const data = nationalSchema.parse(camelKeys(await apiClient<unknown>("/Profile/GetNationalCode")))
	if (data.isSuccessful === false || data.result == null) throw new Error(data.message ?? "national code failed")
	return String(data.result)
}

const infoSchema = z.object({
	...base,
	info: z
		.object({
			firstName: text,
			lastName: text,
			mobileNumber: text,
			postalCode: text,
			address: text,
			customerType: z.number().nullish(),
			hasUser: z.boolean().nullish(),
			usernames: z.array(z.string()).nullish(),
			cityCode: z.number().nullish(),
			provinceCode: z.number().nullish(),
			businessCode: text,
			isMine: z.boolean().nullish(),
		})
		.nullish(),
})

/** What the bank already knows about the person or company the tag is for. */
export interface EtcOwner {
	firstName: string
	lastName: string
	mobile: string
	postalCode: string
	address: string
	customerType: number
	/** The owner already has a toll-tag website account, so a new tag can be added to it. */
	hasUser: boolean
	usernames: string[]
	provinceCode: number
	cityCode: number
	businessCode: string
}

/**
 * Looks the owner up by national code (a person) or company code. Returns null when the bank does not know them: they are
 * then treated as a new customer. Network failures still throw.
 */
export const getEtcOwner = async (code: string): Promise<EtcOwner | null> => {
	const data = infoSchema.parse(camelKeys(await apiClient<unknown>(`/Etc/GetUserInfo?nationalCode=${encodeURIComponent(code)}`)))
	const info = data.info
	if (data.isSuccessful === false || !info) return null
	return {
		firstName: info.firstName ?? "",
		lastName: info.lastName ?? "",
		mobile: info.mobileNumber ?? "",
		postalCode: info.postalCode ?? "",
		address: info.address ?? "",
		customerType: info.customerType ?? 0,
		hasUser: info.hasUser === true,
		usernames: info.usernames ?? [],
		provinceCode: info.provinceCode ?? 0,
		cityCode: info.cityCode ?? 0,
		businessCode: info.businessCode ?? "",
	}
}

export interface EtcPurchase {
	credentials: CardCredentials
	customerType: number
	/** A person's national code; empty for a company. */
	nationalCode: string
	/** A company's code, or what the bank holds for a known owner. */
	businessCode: string
	firstName: string
	lastName: string
	mobile: string
	address: string
	postalCode: string
	provinceCode: number
	cityCode: number
	isTehran: boolean
	/** In Rials: tags plus posting. The bank refuses any other total. */
	amount: number
	hasUser: boolean
	username: string
	password: string
}

/** Buys one toll tag, posted to the address. A real transaction: send once per confirmation, never retry automatically. */
export const purchaseEtc = (request: EtcPurchase): Promise<TransactionResult> =>
	apiClient<unknown>("/Etc/PurchaseEtc", {
		method: "POST",
		body: JSON.stringify({
			nationalCode: request.nationalCode,
			firstName: request.firstName,
			lastName: request.lastName,
			mobileNumber: request.mobile,
			address: request.address,
			postalCode: request.postalCode,
			businessCode: request.businessCode,
			city: request.cityCode,
			chargeAmount: request.amount,
			centerCode: String(request.provinceCode),
			count: 1,
			cardInfo: toCardInfoBody(request.credentials),
			hasUser: request.hasUser,
			etcPassword: request.password,
			etcUserName: request.username,
			customerType: request.customerType,
			isTehranProvince: request.isTehran,
		}),
	}).then(toTransactionResult)
