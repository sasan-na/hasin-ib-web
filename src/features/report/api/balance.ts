import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()
const amount = z.union([z.number(), z.string()]).nullish()

const num = (value: number | string | null | undefined): number => {
	const parsed = Number(value ?? 0)
	return Number.isFinite(parsed) ? parsed : 0
}

const periodSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, result: z.union([z.string(), z.number()]).nullish()})

/** The longest span, in days, the bank draws a balance chart for. */
export const getValidPeriod = async (): Promise<number> => {
	const data = periodSchema.parse(camelKeys(await apiClient<unknown>("/DateTime/StatementValidPeriod")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "period failed")
	const days = num(data.result)
	return days > 0 ? days : 90
}

const diagramSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	days: z.array(z.object({dayNumber: z.number(), balance: amount, withdrawalAmount: amount, depositAmount: amount})).nullish(),
})

export interface BalanceDay {
	/** "YYYY-MM-DD" (Gregorian). */
	date: string
	/** In Rials: the balance at the end of that day. */
	balance: number
	deposit: number
	withdrawal: number
}

export interface BalanceDiagram {
	days: BalanceDay[]
	/** The bank's note when there is nothing to draw (for example, an account with no movement). */
	note: string
}

const addDays = (iso: string, days: number): string => new Date(new Date(`${iso}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)

/**
 * The closing balance of an account on each day between two dates, with what went in and out that day. The bank counts
 * days from the first date and stops at today. Throws with the bank's text when it cannot answer.
 */
export const getBalanceDiagram = async (accountNumber: string, fromIso: string, toIso: string): Promise<BalanceDiagram> => {
	const data = diagramSchema.parse(
		camelKeys(
			await apiClient<unknown>("/BalanceDiagram/GetDiagram", {
				method: "POST",
				body: JSON.stringify({accountNumber, startDate: `${fromIso}T00:00:00Z`, endDate: `${toIso}T00:00:00Z`, isFromMainPage: false, needsUpdate: false}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "balance diagram failed")
	return {
		note: data.message ?? "",
		days: (data.days ?? []).map((day) => ({date: addDays(fromIso, day.dayNumber - 1), balance: num(day.balance), deposit: num(day.depositAmount), withdrawal: num(day.withdrawalAmount)})),
	}
}
