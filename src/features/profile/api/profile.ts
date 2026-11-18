import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()

const personSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	fullName: text,
	imageUrl: text,
	customerCode: text,
	birthCertificateNumber: text,
	nationalCode: text,
	birthDate: text,
	phoneNumber1: text,
	phoneNumber2: text,
	mobileNumber: text,
	emailAddress: text,
	address: text,
	passportNumber: text,
	isMaster: z.boolean().nullish(),
	username: text,
	hasOtp: z.boolean().nullish(),
})

const companySchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	businessCode: text,
	companyTitle: text,
	logoUrl: text,
	websiteAddress: text,
	registrationDate: text,
	registrationCity: text,
	registrationNo: text,
	emailAddress: text,
	faxAddress: text,
	address: text,
	phoneNumber1: text,
	phoneNumber2: text,
	username: text,
	hasOtp: z.boolean().nullish(),
})

/** A line of the profile: what it is and its value. The bank writes "-" for what it does not know; those lines are left out. */
export interface ProfileField {
	key: string
	value: string
	/** Numbers and codes read left to right whatever the language. */
	ltr: boolean
}

export interface Profile {
	kind: "person" | "company"
	/** The person's full name or the company's title. */
	title: string
	username: string
	/** The user signs in with a one-time code, so there is no password to change here. */
	hasOtp: boolean
	fields: ProfileField[]
}

const lines = (entries: [string, string | null | undefined, boolean?][]): ProfileField[] =>
	entries.flatMap(([key, value, ltr]) => {
		const text = (value ?? "").trim()
		return text === "" || text === "-" ? [] : [{key, value: text, ltr: ltr === true}]
	})

/** The signed-in user's details: a person's, or (for a business user) the company's. */
export const getProfile = async (): Promise<Profile> => {
	const person = personSchema.safeParse(camelKeys(await apiClient<unknown>("/Profile/GetUserDetails")))
	if (person.success && person.data.isSuccessful !== false && (person.data.fullName ?? "") !== "") {
		const d = person.data
		return {
			kind: "person",
			title: d.fullName ?? "",
			username: d.username ?? "",
			hasOtp: d.hasOtp === true,
			fields: lines([
				["customerCode", d.customerCode, true],
				["nationalCode", d.nationalCode, true],
				["birthCertificateNumber", d.birthCertificateNumber, true],
				["birthDate", d.birthDate, true],
				["passportNumber", d.passportNumber, true],
				["mobileNumber", d.mobileNumber, true],
				["phoneNumber1", d.phoneNumber1, true],
				["phoneNumber2", d.phoneNumber2, true],
				["emailAddress", d.emailAddress, true],
				["address", d.address],
			]),
		}
	}
	const company = companySchema.parse(camelKeys(await apiClient<unknown>("/Profile/GetCompanyDetails")))
	if (company.isSuccessful === false) throw new Error(company.message ?? "profile failed")
	return {
		kind: "company",
		title: company.companyTitle ?? "",
		username: company.username ?? "",
		hasOtp: company.hasOtp === true,
		fields: lines([
			["businessCode", company.businessCode, true],
			["registrationNo", company.registrationNo, true],
			["registrationDate", company.registrationDate, true],
			["registrationCity", company.registrationCity],
			["phoneNumber1", company.phoneNumber1, true],
			["phoneNumber2", company.phoneNumber2, true],
			["faxAddress", company.faxAddress, true],
			["emailAddress", company.emailAddress, true],
			["websiteAddress", company.websiteAddress, true],
			["address", company.address],
		]),
	}
}

const nationalCodeSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), result: z.union([z.string(), z.number()]).nullish()})

/** The signed-in user's own national code. */
export const getMyNationalCode = async (): Promise<string> => {
	const data = nationalCodeSchema.parse(camelKeys(await apiClient<unknown>("/Profile/GetNationalCode")))
	if (data.isSuccessful === false || data.result == null) throw new Error(data.message ?? "national code failed")
	return String(data.result)
}
