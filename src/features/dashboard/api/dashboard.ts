import { z } from "@/lib/zod"

import { apiClient } from "@/lib/api/client"
import { camelKeys } from "@/lib/api/camel"
import type { PasswordType } from "@/features/transaction/api/transaction"

const text = z.union([z.string(), z.number()]).nullish()

const stateSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	states: z
		.array(z.object({ key: z.number(), title: z.string().nullish() }))
		.nullish(),
})

export interface DashboardState {
	key: number
	title: string
}

const states = async (path: string): Promise<DashboardState[]> => {
	const data = stateSchema.parse(camelKeys(await apiClient<unknown>(path)))
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "states failed")
	return (data.states ?? []).map((state) => ({
		key: state.key,
		title: state.title ?? String(state.key),
	}))
}

/** What the user can filter the waiting items by (waiting to be accepted, signed by me, ...). */
export const getCurrentStates = (): Promise<DashboardState[]> =>
	states("/Dashboard/GetDashboardStates")
/** What the user can filter finished items by (successful, failed). */
export const getHistoryStates = (): Promise<DashboardState[]> =>
	states("/Dashboard/GetDashboardHistoryStates")

const user = z.object({
	username: z.string().nullish(),
	firstName: z.string().nullish(),
	lastName: z.string().nullish(),
	isMaster: z.boolean().nullish(),
	rejectedReason: z.string().nullish(),
	state: text,
	logDateCultured: z.string().nullish(),
})

const currentSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	totalCount: z.number().nullish(),
	workflows: z
		.array(
			z.object({
				workflowRunId: z.number(),
				workflowName: z.string().nullish(),
				serviceName: z.string().nullish(),
				serviceKey: z.string().nullish(),
				accountNumber: z.string().nullish(),
				userAccountId: z.number().nullish(),
				initiatorUser: z.string().nullish(),
				initiateDateTimeCultured: z.string().nullish(),
				isSign: z.boolean().nullish(),
				isView: z.boolean().nullish(),
				currentLevelName: z.string().nullish(),
				currentLevelUsers: z.array(user).nullish(),
				hideProgress: z.boolean().nullish(),
			}),
		)
		.nullish(),
})

export interface WorkflowUser {
	name: string
	username: string
	isMaster: boolean
	/** 0 rejected, 1 accepted, 2 started, -1 not yet. */
	state: number
	date: string
	rejectReason: string
}

const toUser = (item: z.infer<typeof user>): WorkflowUser => ({
	name:
		[item.firstName, item.lastName].filter(Boolean).join(" ") ||
		(item.username ?? ""),
	username: item.username ?? "",
	isMaster: item.isMaster === true,
	state:
		item.state === null || item.state === undefined ? -1 : Number(item.state),
	date: item.logDateCultured ?? "",
	rejectReason: item.rejectedReason ?? "",
})

export interface WorkflowItem {
	id: number
	name: string
	serviceName: string
	/** The bank's key for the service; used to ask for the transaction's details. */
	serviceKey: string
	accountNumber: string
	/** The user's own account record, which says whether a password is needed. */
	userAccountId: number | null
	initiator: string
	date: string
	/** The next step is signing (which also sends the transaction) rather than accepting. */
	isSign: boolean
	/** Only to be looked at: it is not waiting for this user. */
	isView: boolean
	levelName: string
	levelUsers: WorkflowUser[]
	hideProgress: boolean
}

export interface WorkflowPage {
	items: WorkflowItem[]
	total: number
}

export interface WorkflowFilter {
	title: string
	states: number[]
}

const body = (
	filter: WorkflowFilter,
	offset: number,
	pageSize: number,
): string =>
	JSON.stringify({
		pageSize,
		offset,
		title: filter.title || undefined,
		states: filter.states,
	})

/** Items waiting for (or started by, or answered by) this user. */
export const getWorkflows = async (
	filter: WorkflowFilter,
	offset: number,
	pageSize: number,
): Promise<WorkflowPage> => {
	const data = currentSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Dashboard/GetDashboardItems", {
				method: "POST",
				body: body(filter, offset, pageSize),
			}),
		),
	)
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "dashboard failed")
	return {
		total: data.totalCount ?? 0,
		items: (data.workflows ?? []).map((item) => ({
			id: item.workflowRunId,
			name: item.workflowName ?? "",
			serviceName: item.serviceName ?? "",
			serviceKey: item.serviceKey ?? "",
			accountNumber: item.accountNumber ?? "",
			userAccountId: item.userAccountId ?? null,
			initiator: item.initiatorUser ?? "",
			date: item.initiateDateTimeCultured ?? "",
			isSign: item.isSign === true,
			isView: item.isView === true,
			levelName: item.currentLevelName ?? "",
			levelUsers: (item.currentLevelUsers ?? []).map(toUser),
			hideProgress: item.hideProgress === true,
		})),
	}
}

const historySchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	totalCount: z.number().nullish(),
	workflows: z
		.array(
			z.object({
				workflowRunId: z.number(),
				workflowName: z.string().nullish(),
				serviceName: z.string().nullish(),
				accountNumber: z.string().nullish(),
				initiatorUser: z.string().nullish(),
				initiateDateTimeCultured: z.string().nullish(),
				endDateTimeCultured: z.string().nullish(),
				isSuccessful: z.boolean().nullish(),
			}),
		)
		.nullish(),
})

export interface HistoryItem {
	id: number
	name: string
	serviceName: string
	accountNumber: string
	initiator: string
	started: string
	ended: string
	successful: boolean
}

export interface HistoryPage {
	items: HistoryItem[]
	total: number
}

/** Items that have finished, successfully or not. */
export const getHistory = async (
	filter: WorkflowFilter,
	offset: number,
	pageSize: number,
): Promise<HistoryPage> => {
	const data = historySchema.parse(
		camelKeys(
			await apiClient<unknown>("/Dashboard/GetDashboardHistoryItems", {
				method: "POST",
				body: body(filter, offset, pageSize),
			}),
		),
	)
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "history failed")
	return {
		total: data.totalCount ?? 0,
		items: (data.workflows ?? []).map((item) => ({
			id: item.workflowRunId,
			name: item.workflowName ?? "",
			serviceName: item.serviceName ?? "",
			accountNumber: item.accountNumber ?? "",
			initiator: item.initiatorUser ?? "",
			started: item.initiateDateTimeCultured ?? "",
			ended: item.endDateTimeCultured ?? "",
			successful: item.isSuccessful === true,
		})),
	}
}

const detailsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	accountNumber: z.string().nullish(),
	keyValues: z
		.array(
			z.object({
				label: z.string().nullish(),
				value: text,
				type: z.string().nullish(),
				key: z.string().nullish(),
			}),
		)
		.nullish(),
	batchDetails: z
		.object({
			title: z.string().nullish(),
			headers: z.array(z.object({ header: z.string().nullish() })).nullish(),
			rows: z.array(z.array(text)).nullish(),
		})
		.nullish(),
})

export interface TransactionDetails {
	fields: { label: string; value: string; type: string; key: string }[]
	batch: { title: string; headers: string[]; rows: string[][] } | null
}

/** What the waiting transaction would do, as label/value pairs; a group transfer also lists its rows. */
export const getTransactionDetails = async (
	workflowRunId: number,
	serviceKey: string,
): Promise<TransactionDetails> => {
	const raw = await apiClient<unknown>(
		`/${encodeURIComponent(serviceKey)}/GetDashboardDetails?workflowRunId=${encodeURIComponent(String(workflowRunId))}`,
	)
	const data = detailsSchema.parse(camelKeys(raw))
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "details failed")
	return {
		fields: (data.keyValues ?? []).map((field) => ({
			label: field.label ?? "",
			value:
				field.value === null || field.value === undefined
					? ""
					: String(field.value),
			type: field.type ?? "String",
			key: field.key ?? "",
		})),
		batch: data.batchDetails
			? {
					title: data.batchDetails.title ?? "",
					headers: (data.batchDetails.headers ?? []).map(
						(header) => header.header ?? "",
					),
					rows: (data.batchDetails.rows ?? []).map((row) =>
						row.map((cell) =>
							cell === null || cell === undefined ? "" : String(cell),
						),
					),
				}
			: null,
	}
}

const progressSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	initiators: z.array(user).nullish(),
	levels: z
		.array(
			z.object({
				levelNumber: z.number().nullish(),
				users: z.array(user).nullish(),
			}),
		)
		.nullish(),
	signatories: z.array(user).nullish(),
})

export interface WorkflowProgress {
	initiators: WorkflowUser[]
	levels: { number: number; users: WorkflowUser[] }[]
	signatories: WorkflowUser[]
}

/** Who has to start, accept and sign an item, and who already did. */
export const getWorkflowProgress = async (
	workflowRunId: number,
): Promise<WorkflowProgress> => {
	const data = progressSchema.parse(
		camelKeys(
			await apiClient<unknown>(
				`/Dashboard/GetWorkflowDetails?workflowRunId=${encodeURIComponent(String(workflowRunId))}`,
			),
		),
	)
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "workflow failed")
	return {
		initiators: (data.initiators ?? []).map(toUser),
		levels: (data.levels ?? []).map((level) => ({
			number: level.levelNumber ?? 0,
			users: (level.users ?? []).map(toUser),
		})),
		signatories: (data.signatories ?? []).map(toUser),
	}
}

export interface WorkflowAnswer {
	workflowRunId: number
	accept: boolean
	/** The item is at its signing step: signing records the signature, and the transaction is then sent separately. */
	isSign: boolean
	/** Only a rejection needs a reason. */
	rejectReason: string
	/** The account's password or code, when the account asks for one. */
	password: string | null
	passwordType: PasswordType
}

const answerSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	shouldExecute: z.boolean().nullish(),
	workflowShouldBeEdited: z.boolean().nullish(),
})

export interface AnswerResult {
	/** The bank asks the caller to now send the approved transaction itself (not built here). */
	shouldExecute: boolean
}

/**
 * Accepts or rejects a waiting item. A real action on the bank's side: send once per confirmation, never retry
 * automatically. When this was a signature, `shouldExecute` says the caller must now send the transaction (executeSigned).
 */
export const answerWorkflow = async (
	answer: WorkflowAnswer,
): Promise<AnswerResult> => {
	const data = answerSchema.parse(
		camelKeys(
			await apiClient<unknown>("/Workflow/DashboardAction", {
				method: "POST",
				body: JSON.stringify({
					workflowRunId: answer.workflowRunId,
					isSign: answer.isSign,
					isAccepted: answer.accept,
					rejectReason: answer.accept ? undefined : answer.rejectReason,
					...(answer.password ? { accountPin: answer.password } : {}),
					passwordType: answer.passwordType,
				}),
			}),
		),
	)
	if (data.isSuccessful === false)
		throw new Error(data.message ?? "answer failed")
	return { shouldExecute: data.shouldExecute === true }
}

const executeSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	extendedMessage: z.string().nullish(),
})

export interface SignedExecution {
	workflowRunId: number
	/** The bank's key for the service; its transaction is what gets sent. */
	serviceKey: string
	/** True for a standing order to a card: the bank has one key for both kinds and tells them apart by this. */
	toCard: boolean
	accountNumber: string
	password: string | null
	passwordType: PasswordType
}

/**
 * Sends the transaction an item has just been signed for. A real transaction: send once per signature, never retry
 * automatically. Resolves with the bank's text when it refused; rejects when the request failed on the way, so nobody
 * knows whether the bank acted.
 */
export const executeSigned = async (
	execution: SignedExecution,
): Promise<{ ok: boolean; message: string }> => {
	const key =
		execution.serviceKey === "RegisterStandingOrder" && execution.toCard
			? "RegisterStandingOrderCard"
			: execution.serviceKey
	const data = executeSchema.parse(
		camelKeys(
			await apiClient<unknown>(
				`/${encodeURIComponent(key)}/DoDashboardTransaction`,
				{
					method: "POST",
					body: JSON.stringify({
						workflowRunId: execution.workflowRunId,
						accountInfo: {
							accountNumber: execution.accountNumber,
							accountPin: execution.password ?? undefined,
							passwordType: execution.passwordType,
						},
					}),
				},
			),
		),
	)
	return {
		ok: data.isSuccessful !== false,
		message: data.extendedMessage ?? data.message ?? "",
	}
}
