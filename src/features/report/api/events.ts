import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	totalCount: z.number().nullish(),
	archiveNotification: text,
	eventList: z.array(z.object({id: z.number().nullish(), dateTime: text, description: text, ip: text, transactionType: text})).nullish(),
})

/** Something the user did in the bank (or tried to): a transfer, a sign-in, a change of password. */
export interface BankEvent {
	id: number
	/** Written by the server in the UI language. */
	dateTime: string
	type: string
	description: string
	ip: string
}

export interface EventFilter {
	/** "current" is this bank's record; "archive" is the old internet bank's. */
	source: "current" | "archive"
	/** The id of a kind of event (current record only). */
	typeId: string
	/** A word in the kind's title (archive only). */
	typeText: string
	/** "YYYY-MM-DD" or empty. */
	from: string
	to: string
	ip: string
	description: string
}

export interface EventPage {
	events: BankEvent[]
	total: number
	/** The server's note when the search reaches back before the archive date. */
	note: string
}

/** One page of events, newest first. */
export const getEvents = async (filter: EventFilter, startIndex: number, count: number): Promise<EventPage> => {
	const params = new URLSearchParams({startIndex: String(startIndex), count: String(count)})
	if (filter.from !== "") params.set("fromDate", filter.from)
	if (filter.to !== "") params.set("toDate", filter.to)
	if (filter.ip !== "") params.set("ip", filter.ip)
	if (filter.description !== "") params.set("description", filter.description)
	const archive = filter.source === "archive"
	if (archive && filter.typeText !== "") params.set("transactionType", filter.typeText)
	if (!archive && filter.typeId !== "") params.set("transactionType", filter.typeId)
	const data = listSchema.parse(camelKeys(await apiClient<unknown>(`${archive ? "/event/GetOldEvents" : "/Event"}?${params.toString()}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "events failed")
	return {
		total: data.totalCount ?? 0,
		note: data.archiveNotification ?? "",
		events: (data.eventList ?? []).map((event) => ({
			id: event.id ?? 0,
			dateTime: event.dateTime ?? "",
			type: event.transactionType ?? "",
			description: event.description ?? "",
			ip: event.ip ?? "",
		})),
	}
}

const typesSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, transactionTypes: z.array(z.object({id: z.number(), name: text})).nullish()})

export interface EventType {
	id: number
	name: string
}

/** The kinds of event the user can filter by. */
export const getEventTypes = async (): Promise<EventType[]> => {
	const data = typesSchema.parse(camelKeys(await apiClient<unknown>("/event/GetTransactionTypes")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "event types failed")
	return (data.transactionTypes ?? []).map((type) => ({id: type.id, name: type.name ?? String(type.id)}))
}
