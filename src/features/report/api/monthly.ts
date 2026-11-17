import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()
const amount = z.union([z.number(), z.string()]).nullish()

const statementSchema = z.object({referenceNumber: text, amount, time: text, description: text})

const reportSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	startDay: z.number().nullish(),
	totalDeposit: amount,
	totalWithdrawal: amount,
	days: z
		.array(
			z.object({
				isToday: z.boolean().nullish(),
				isHoliday: z.boolean().nullish(),
				transactionCount: z.number().nullish(),
				depositAmount: amount,
				withdrawalAmount: amount,
				balance: amount,
				depositStatements: z.array(statementSchema).nullish(),
				withdrawalStatements: z.array(statementSchema).nullish(),
			}),
		)
		.nullish(),
})

const num = (value: number | string | null | undefined): number => {
	const parsed = Number(value ?? 0)
	return Number.isFinite(parsed) ? parsed : 0
}

/** One line of a day's statement. */
export interface DayStatement {
	reference: string
	/** In Rials. */
	amount: number
	time: string
	description: string
}

export interface CalendarDay {
	/** 1-based day of the month. */
	number: number
	isToday: boolean
	isHoliday: boolean
	transactionCount: number
	deposit: number
	withdrawal: number
	/** The balance at the end of the day; 0 on a day without movement. */
	balance: number
	deposits: DayStatement[]
	withdrawals: DayStatement[]
}

export interface MonthlyReport {
	/** The column of the first day: 1 is the first day of the week (Saturday in the Persian calendar). */
	startDay: number
	days: CalendarDay[]
	totalDeposit: number
	totalWithdrawal: number
}

const statements = (list: z.infer<typeof statementSchema>[] | null | undefined): DayStatement[] =>
	(list ?? []).map((item) => ({reference: item.referenceNumber ?? "", amount: num(item.amount), time: item.time ?? "", description: item.description ?? ""}))

/**
 * What went in and out of an account on each day of a month. The server counts the month in the calendar of the
 * UI language (Persian for Persian, Gregorian for English). Throws with the bank's text when it cannot answer.
 */
export const getMonthlyReport = async (accountNumber: string, year: number, month: number): Promise<MonthlyReport> => {
	const data = reportSchema.parse(camelKeys(await apiClient<unknown>("/MonthlyReport/GetReport", {method: "POST", body: JSON.stringify({year, month, accountInfo: {accountNumber}})})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "monthly report failed")
	return {
		startDay: data.startDay ?? 1,
		totalDeposit: num(data.totalDeposit),
		totalWithdrawal: num(data.totalWithdrawal),
		days: (data.days ?? []).map((day, index) => ({
			number: index + 1,
			isToday: day.isToday === true,
			isHoliday: day.isHoliday === true,
			transactionCount: day.transactionCount ?? 0,
			deposit: num(day.depositAmount),
			withdrawal: num(day.withdrawalAmount),
			balance: num(day.balance),
			deposits: statements(day.depositStatements),
			withdrawals: statements(day.withdrawalStatements),
		})),
	}
}
