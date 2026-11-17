import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.union([z.string(), z.number()]).nullish()

const typesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	tableItems: z
		.array(z.object({description: z.string().nullish(), installmentAmount: text, installmentRate: text, isStep: z.boolean().nullish()}))
		.nullish(),
})

const kindsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	isNotStepdList: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish(),
	isStepedList: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish(),
})

const num = (value: string | number | null | undefined): number | null => {
	if (value === null || value === undefined || value === "") return null
	const parsed = Number(String(value).replace(/,/g, ""))
	return Number.isFinite(parsed) ? parsed : null
}

/** A kind of loan the bank offers: its largest amount, yearly rate and whether its installments step up. */
export interface LoanOffer {
	/** Unique within the list; sent back as the rate title. */
	title: string
	/** Largest loan, in Rials. */
	maxAmount: number
	/** Yearly profit rate in percent. */
	rate: number
	stepped: boolean
}

export interface InstallmentKind {
	id: number
	name: string
}

export interface InterestOptions {
	offers: LoanOffer[]
	/** The repayment kinds allowed for loans without stepped installments. */
	plainKinds: InstallmentKind[]
	/** The repayment kinds allowed for stepped loans. */
	steppedKinds: InstallmentKind[]
}

const kinds = (list: {id: number; name?: string | null}[] | null | undefined): InstallmentKind[] => (list ?? []).map((item) => ({id: item.id, name: item.name ?? String(item.id)}))

export const getInterestOptions = async (): Promise<InterestOptions> => {
	const [types, dropdown] = await Promise.all([
		apiClient<unknown>("/Installment/GetType").then((raw) => typesSchema.parse(camelKeys(raw))),
		apiClient<unknown>("/Installment/DropDownTypes").then((raw) => kindsSchema.parse(camelKeys(raw))),
	])
	if (types.isSuccessful === false) throw new Error(types.message ?? "loan types failed")
	if (dropdown.isSuccessful === false) throw new Error(dropdown.message ?? "loan kinds failed")
	return {
		offers: (types.tableItems ?? []).map((item) => ({
			title: item.description ?? "",
			maxAmount: num(item.installmentAmount) ?? 0,
			rate: num(item.installmentRate) ?? 0,
			stepped: item.isStep === true,
		})),
		plainKinds: kinds(dropdown.isNotStepdList),
		steppedKinds: kinds(dropdown.isStepedList),
	}
}

export interface InterestRequest {
	offer: LoanOffer
	/** In Rials. */
	amount: number
	installments: number
	kindId: number
	lifeInsurance: boolean
	mehr: boolean
}

const resultSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	installmentAmount: text,
	installmentNumber: text,
	installmentType: z.string().nullish(),
	accountProfitAmount: text,
	infoItems: z.object({loanPeriods: z.array(z.object({paymentDescription: z.string().nullish(), paymentRound: text})).nullish()}).nullish(),
})

export interface InterestResult {
	amount: number | null
	installments: number | null
	kind: string
	/** The profit the loan costs in total, in Rials. */
	profit: number | null
	/** What is paid each period; a plain loan has one row, a stepped loan one per step. */
	periods: {label: string; amount: number | null}[]
}

/** Works out what a loan would cost. Nothing is requested from or paid to the bank. */
export const calculateInterest = async (request: InterestRequest): Promise<InterestResult> => {
	const data = resultSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Installment/GetInterest", {
				method: "POST",
				body: JSON.stringify({
					installmentAmount: request.amount,
					installmentNumber: request.installments,
					installmentType: request.kindId,
					interestRate: request.offer.rate,
					interestRateTitle: request.offer.title,
					isSimple: !request.offer.stepped,
					lifeInsurance: request.lifeInsurance,
					isMehr: request.mehr,
				}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "interest failed")
	return {
		amount: num(data.installmentAmount),
		installments: num(data.installmentNumber),
		kind: data.installmentType ?? "",
		profit: num(data.accountProfitAmount),
		periods: (data.infoItems?.loanPeriods ?? []).map((period) => ({label: period.paymentDescription ?? "", amount: num(period.paymentRound)})),
	}
}
