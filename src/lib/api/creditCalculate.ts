import {z} from "@/lib/zod"

import {apiClient} from "./client"
import {camelKeys} from "./camel"

// ---- What the account can be calculated against -------------------------------------------------

const loanOptionsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	openingDate: z.string().nullish(),
	types: z.array(z.object({mcdsLoanTypeId: z.number(), duration: z.number(), profit: z.number(), title: z.string().nullish()})).nullish(),
})

export interface LoanType {
	/** What is sent back when calculating. */
	id: number
	/** Repayment period in months. */
	months: number
	/** Yearly profit/fee rate in percent. */
	profitRate: number
}

export interface LoanOptions {
	/** When the account was opened, as "YYYY/MM/DD" (Persian calendar); empty if unknown. */
	openingDate: string
	types: LoanType[]
}

export const getLoanOptions = async (accountNumber: string): Promise<LoanOptions> => {
	const data = loanOptionsSchema.parse(
		camelKeys(await apiClient<unknown>("/Account/GetInfo", {method: "POST", body: JSON.stringify({accountNumber})})),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "loan options failed")
	return {
		openingDate: (data.openingDate ?? "").replace(/-/g, "/").trim(),
		types: (data.types ?? []).map((type) => ({id: type.mcdsLoanTypeId, months: type.duration, profitRate: type.profit})),
	}
}

// ---- The calculation ----------------------------------------------------------------------------

const calculationSchema = z.object({
	isSuccessful: z.boolean(),
	message: z.string().nullish(),
	extendedMessage: z.string().nullish(),
	result: z
		.object({
			accountOpeningDate: z.string().nullish(),
			accountOpeningBranchCode: z.string().nullish(),
			accountBalance: z.number().nullish(),
			receivableLoans: z.number().nullish(),
			actualCredit: z.number().nullish(),
			averageLoanBalanceDetails: z
				.array(
					z.object({
						waitingPeriod: z.number().nullish(),
						calculationStartDate: z.string().nullish(),
						calculationEndDate: z.string().nullish(),
						averageBalancePeriod: z.number().nullish(),
						belongedLoanAmount: z.number().nullish(),
					}),
				)
				.nullish(),
		})
		.nullish(),
})

export interface CreditPeriod {
	/** Months to wait before the facility can be received. */
	waitingMonths: number | null
	from: string
	to: string
	/** The average balance over the period, in Rials. */
	averageBalance: number | null
	/** The facility the account qualifies for over this period, in Rials. */
	facilityAmount: number | null
}

export interface CreditResult {
	openingDate: string
	openingBranchCode: string
	balance: number | null
	receivable: number | null
	actualCredit: number | null
	periods: CreditPeriod[]
}

export interface CreditRequest {
	accountNumber: string
	/** "YYYY/MM/DD", Persian calendar. */
	startDate: string
	endDate: string
	/** The chosen repayment option; null lets the bank use its default. */
	loanTypeId: number | null
}

/** Estimates the facility the account qualifies for between two dates. Throws with the bank's text when it cannot. */
export const calculateCredit = async (request: CreditRequest): Promise<CreditResult> => {
	const data = calculationSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Facility/CreditCalculate", {
				method: "POST",
				body: JSON.stringify({
					accountNumber: request.accountNumber,
					startDate: request.startDate,
					endDate: request.endDate,
					requestedLoanTypeId: request.loanTypeId ?? 0,
				}),
			}),
		),
	)
	if (!data.isSuccessful || !data.result) throw new Error(data.extendedMessage ?? data.message ?? "")
	const {result} = data
	return {
		openingDate: result.accountOpeningDate ?? "",
		openingBranchCode: result.accountOpeningBranchCode ?? "",
		balance: result.accountBalance ?? null,
		receivable: result.receivableLoans ?? null,
		actualCredit: result.actualCredit ?? null,
		periods: (result.averageLoanBalanceDetails ?? []).map((period) => ({
			waitingMonths: period.waitingPeriod ?? null,
			from: period.calculationStartDate ?? "",
			to: period.calculationEndDate ?? "",
			averageBalance: period.averageBalancePeriod ?? null,
			facilityAmount: period.belongedLoanAmount ?? null,
		})),
	}
}
