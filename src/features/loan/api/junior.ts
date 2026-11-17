import { z } from "@/lib/zod"

import { apiClient } from "@/lib/api/client"
import { camelKeys } from "@/lib/api/camel"

const text = z.union([z.string(), z.number()]).nullish()
const cell = (value: string | number | null | undefined): string =>
	value === null || value === undefined ? "" : String(value).trim()

const tableSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	tableItems: z
		.array(
			z.object({
				paymentYear: text,
				leastPay: text,
				finalRemain: text,
				finalBody: text,
				yearBody: text,
				averageBody: text,
				leastFacility: text,
				tehranMaxFacility: text,
				tehranCoefficient: text,
				bigCityFacility: text,
				bigCityCoefficient: text,
				otherCityFacility: text,
				otherCityCoefficient: text,
			}),
		)
		.nullish(),
})

/** One deposit year of the youth housing deposit table. Amounts and coefficients are kept as the bank wrote them. */
export interface JuniorRow {
	paymentYear: string
	leastPay: string
	finalRemain: string
	/** Account body at the end of each year, together. */
	finalBody: string
	/** Account body at the end of each year, separately. */
	yearBody: string
	averageBody: string
	leastFacility: string
	tehranMax: string
	tehranCoefficient: string
	bigCityMax: string
	bigCityCoefficient: string
	otherCityMax: string
	otherCityCoefficient: string
}

/** The table of what a youth housing deposit opened in the given (Persian) year pays in and what facility it earns. */
export const getJuniorTable = async (year: number): Promise<JuniorRow[]> => {
	const data = tableSchema.parse(
		camelKeys(
			await apiClient<unknown>(
				`/JuniorDeposit/GetTable?year=${encodeURIComponent(String(year))}`,
			),
		),
	)
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "junior table failed")
	return (data.tableItems ?? []).map((item) => ({
		paymentYear: cell(item.paymentYear),
		leastPay: cell(item.leastPay),
		finalRemain: cell(item.finalRemain),
		finalBody: cell(item.finalBody),
		yearBody: cell(item.yearBody),
		averageBody: cell(item.averageBody),
		leastFacility: cell(item.leastFacility),
		tehranMax: cell(item.tehranMaxFacility),
		tehranCoefficient: cell(item.tehranCoefficient),
		bigCityMax: cell(item.bigCityFacility),
		bigCityCoefficient: cell(item.bigCityCoefficient),
		otherCityMax: cell(item.otherCityFacility),
		otherCityCoefficient: cell(item.otherCityCoefficient),
	}))
}

const citiesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	list: z
		.array(z.object({ id: z.number(), name: z.string().nullish() }))
		.nullish(),
})

export interface CityType {
	id: number
	name: string
}

export const getJuniorCities = async (): Promise<CityType[]> => {
	const data = citiesSchema.parse(
		camelKeys(await apiClient<unknown>("/JuniorDeposit/GetCities")),
	)
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "city types failed")
	return (data.list ?? []).map((item) => ({
		id: item.id,
		name: item.name ?? String(item.id),
	}))
}

const installmentSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	maxPaymentAmount: text,
	depositPaymentAmount: text,
	year: z.number().nullish(),
	tableItems: z
		.array(z.object({ year: text, monthlyPayment: text, annualPayment: text }))
		.nullish(),
})

export interface JuniorInstallments {
	/** The facility the deposit earns, as the bank wrote it. */
	facility: string
	/** What is paid in one lump sum when opening. */
	lumpSum: string
	rows: { year: string; monthly: string; annual: string }[]
}

/** What to pay in, for a deposit opened in a year, in a type of city, to wait a number of years for the facility. */
export const getJuniorInstallments = async (request: {
	year: number
	cityType: number
	waitYears: number
}): Promise<JuniorInstallments> => {
	const query = new URLSearchParams({
		openYear: String(request.year),
		cityType: String(request.cityType),
		waitDuration: String(request.waitYears),
	})
	const data = installmentSchema.parse(
		camelKeys(
			await apiClient<unknown>(
				`/JuniorDeposit/GetInstallment?${query.toString()}`,
			),
		),
	)
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "junior installments failed")
	return {
		facility: cell(data.maxPaymentAmount),
		lumpSum: cell(data.depositPaymentAmount),
		rows: (data.tableItems ?? []).map((item) => ({
			year: cell(item.year),
			monthly: cell(item.monthlyPayment),
			annual: cell(item.annualPayment),
		})),
	}
}
