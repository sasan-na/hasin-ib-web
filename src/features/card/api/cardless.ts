import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toCardInfoBody, type CardCredentials} from "@/features/card/api/card-credentials"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

const text = z.string().nullish()

// ---- The bank's limits -------------------------------------------------------------------------

const configSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, maxAmount: text, minAmount: text, amountRatio: text, maxPasswordLength: text, minPasswordLength: text})

export interface CardlessConfig {
	/** In Rials. */
	minAmount: number
	maxAmount: number
	/** The amount must be a multiple of this. */
	ratio: number
	/** How many digits the one-time withdrawal password may have. */
	minPasswordLength: number
	maxPasswordLength: number
}

const num = (value: string | null | undefined, fallback: number): number => {
	const parsed = Number(String(value ?? "").replace(/,/g, ""))
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const getCardlessConfig = async (): Promise<CardlessConfig> => {
	const data = configSchema.parse(camelKeys(await apiClient<unknown>("/Cardless/GetConfigs")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "cardless config failed")
	return {
		minAmount: num(data.minAmount, 1),
		maxAmount: num(data.maxAmount, 10_000_000_000),
		ratio: num(data.amountRatio, 1),
		minPasswordLength: num(data.minPasswordLength, 4),
		maxPasswordLength: num(data.maxPasswordLength, 12),
	}
}

// ---- The user's withdrawal tickets ------------------------------------------------------------

const ticketSchema = z.object({
	actionCode: text,
	cardNumber: text,
	ticketAmount: text,
	remainingAmount: text,
	phoneNumber: text,
	showTransactionDate: text,
	traceNumber: text,
	ticketStatus: text,
	ticketStatusDesc: text,
	errorDescription: text,
	userCardId: z.number().nullish(),
})

const listSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, cardItems: z.array(ticketSchema).nullish()})

/** The bank's status code of a ticket that nobody has used yet: the only one that can be cancelled. */
export const STATUS_NOT_TAKEN = "4"

export interface CardlessTicket {
	cardId: number
	cardNumber: string
	traceNumber: string
	mobile: string
	/** In Rials. */
	amount: number
	remaining: number | null
	date: string
	statusCode: string
	status: string
	canCancel: boolean
}

export interface CardlessCardProblem {
	cardNumber: string
	message: string
}

export interface CardlessList {
	tickets: CardlessTicket[]
	/** Cards whose tickets the bank could not fetch right now. */
	problems: CardlessCardProblem[]
}

/** The tickets on all of the user's cards. The bank asks its core system, so this can be slow. */
export const getCardlessTickets = async (): Promise<CardlessList> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/BatchCardlessCash/GetList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "cardless list failed")
	const tickets: CardlessTicket[] = []
	const problems: CardlessCardProblem[] = []
	for (const item of data.cardItems ?? []) {
		// An action code other than "0" is the bank's way of saying this card's tickets could not be read.
		if (item.actionCode !== "0") {
			problems.push({cardNumber: item.cardNumber ?? "", message: item.errorDescription ?? ""})
			continue
		}
		const remaining = item.remainingAmount === null || item.remainingAmount === undefined || item.remainingAmount === "" ? null : num(item.remainingAmount, 0)
		tickets.push({
			cardId: item.userCardId ?? 0,
			cardNumber: item.cardNumber ?? "",
			traceNumber: item.traceNumber ?? "",
			mobile: item.phoneNumber ?? "",
			amount: num(item.ticketAmount, 0),
			remaining,
			date: item.showTransactionDate ?? "",
			statusCode: item.ticketStatus ?? "",
			status: item.ticketStatusDesc ?? "",
			canCancel: item.ticketStatus === STATUS_NOT_TAKEN,
		})
	}
	return {tickets, problems}
}

// ---- Issuing and cancelling -------------------------------------------------------------------

export interface IssueCardlessRequest {
	credentials: CardCredentials
	mobile: string
	/** In Rials. */
	amount: number
	/** The digits the receiver types at the ATM. */
	password: string
	/** Keep it as a shortcut for next time. */
	remember: boolean
}

/** Issues a card-less withdrawal ticket. A real transaction: send once per confirmation, never retry automatically. */
export const issueCardless = (request: IssueCardlessRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/Cardless/receiptIssuance", {
		method: "POST",
		body: JSON.stringify({
			cardInfo: toCardInfoBody(request.credentials),
			mobileNumber: request.mobile,
			amount: request.amount,
			password: request.password,
			isrepetitive: request.remember,
		}),
	}).then(toTransactionResult)

export interface CancelCardlessRequest {
	credentials: CardCredentials
	ticket: CardlessTicket
}

/** Cancels an unused ticket. A real transaction: send once per confirmation, never retry automatically. */
export const cancelCardless = (request: CancelCardlessRequest): Promise<TransactionResult> =>
	apiClient<unknown>("/CancelCardless/receiptCancellation", {
		method: "POST",
		body: JSON.stringify({
			cardInfo: toCardInfoBody(request.credentials),
			traceNumber: request.ticket.traceNumber,
			mobileNumber: request.ticket.mobile,
			amount: request.ticket.amount,
		}),
	}).then(toTransactionResult)
