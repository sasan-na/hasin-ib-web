import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const servicesSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), serviceList: z.array(z.object({name: z.string().nullish(), id: z.number()})).nullish()})

export interface OldService {
	id: number
	name: string
}

/** The kinds of request the old internet bank recorded. */
export const getOldServices = async (): Promise<OldService[]> => {
	const data = servicesSchema.parse(camelKeys(await apiClient<unknown>("/DashboardHistory/GetOldIbServices")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "old services failed")
	return (data.serviceList ?? []).map((service) => ({id: service.id, name: service.name ?? String(service.id)}))
}

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	showMore: z.boolean().nullish(),
	archiveNotification: z.string().nullish(),
	historyList: z.array(z.object({id: z.number(), isFinished: z.boolean().nullish(), isSuccessful: z.boolean().nullish(), startDateTime: z.string().nullish(), endDateTime: z.string().nullish(), type: z.string().nullish(), typeId: z.number().nullish()})).nullish(),
})

export interface OldRecord {
	id: number
	typeId: number
	type: string
	started: string
	ended: string
	successful: boolean
}

export interface OldFilter {
	/** "YYYY-MM-DD" or empty. */
	startFrom: string
	startTo: string
	endFrom: string
	endTo: string
	typeId: string
	successful: boolean
	failed: boolean
}

export interface OldPage {
	records: OldRecord[]
	/** The bank says there may be more after this page. */
	more: boolean
	note: string
}

const day = (value: string, end: boolean): string | undefined => (value === "" ? undefined : `${value}T${end ? "23:59:59" : "00:00:00"}`)

/** Approvals from the old internet bank, newest first. */
export const getOldHistory = async (filter: OldFilter, startIndex: number, count: number): Promise<OldPage> => {
	const data = listSchema.parse(
		camelKeys(
			await apiClient<unknown>("/DashboardHistory/GetList", {
				method: "POST",
				body: JSON.stringify({
					startIndex,
					count,
					startFromDate: day(filter.startFrom, false),
					startToDate: day(filter.startTo, true),
					endFromDate: day(filter.endFrom, false),
					endToDate: day(filter.endTo, true),
					transactionType: filter.typeId === "" ? undefined : Number(filter.typeId),
					isSuccessful: filter.successful,
					isNotSuccessful: filter.failed,
				}),
			}),
		),
	)
	if (data.isSuccessful === false) throw new Error(data.message ?? "old history failed")
	return {
		records: (data.historyList ?? []).map((item) => ({id: item.id, typeId: item.typeId ?? 0, type: item.type ?? "", started: item.startDateTime ?? "", ended: item.endDateTime ?? "", successful: item.isSuccessful === true})),
		more: data.showMore === true,
		note: data.archiveNotification ?? "",
	}
}

const text = z.union([z.string(), z.number()]).nullish()
const detailSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	transactionName: z.string().nullish(),
	hasList: z.boolean().nullish(),
	list: z.array(z.object({key: z.string().nullish(), obj: z.unknown().nullish()})).nullish(),
	headers: z.array(z.string()).nullish(),
	keyValue: z.array(z.array(z.object({key: z.string().nullish(), obj: z.unknown().nullish()}))).nullish(),
})

export interface OldDetails {
	name: string
	fields: {label: string; value: string}[]
	headers: string[]
	rows: string[][]
}

const show = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "")

/** What one old record asked for, as label and value pairs. */
export const getOldDetails = async (record: Pick<OldRecord, "id" | "typeId">): Promise<OldDetails> => {
	const data = detailSchema.parse(camelKeys(await apiClient<unknown>("/DashboardHistory/GetDetails", {method: "POST", body: JSON.stringify({id: record.id, type: record.typeId})})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "old details failed")
	void text
	return {
		name: data.transactionName ?? "",
		fields: (data.list ?? []).flatMap((item) => (item.key && show(item.obj) !== "" ? [{label: item.key, value: show(item.obj)}] : [])),
		headers: data.headers ?? [],
		rows: (data.keyValue ?? []).map((row) => row.map((cell) => show(cell.obj))),
	}
}
