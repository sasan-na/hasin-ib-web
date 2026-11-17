import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	list: z
		.array(
			z.object({
				id: z.number(),
				subject: text,
				adminGroupTitle: text,
				creationDate: text,
				isFromOldIb: z.boolean().nullish(),
				isRead: z.boolean().nullish(),
				unreadMessageCount: z.number().nullish(),
			}),
		)
		.nullish(),
})

/** One conversation with the bank, as the inbox shows it. */
export interface MessageSummary {
	id: number
	subject: string
	/** The department the conversation is with. */
	department: string
	/** Date of the latest entry, already written in the UI language by the server. */
	date: string
	/** A message kept from the old internet bank: it can be read but not answered or deleted. */
	isOld: boolean
	/** The bank wrote last and the user has not opened it yet. */
	isUnread: boolean
	unreadCount: number
}

export const getMessages = async (): Promise<MessageSummary[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/Chat/GetList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "messages failed")
	return (data.list ?? []).map((item) => ({
		id: item.id,
		subject: item.subject ?? "",
		department: item.adminGroupTitle ?? "",
		date: item.creationDate ?? "",
		isOld: item.isFromOldIb === true,
		isUnread: item.isRead === false,
		unreadCount: item.unreadMessageCount ?? 0,
	}))
}

const detailSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	subject: text,
	adminGroupTitle: text,
	chatHeadId: z.number().nullish(),
	fullName: text,
	chats: z.array(z.object({id: z.number().nullish(), adminUserId: z.number().nullish(), body: text, date: text})).nullish(),
})

export interface ChatEntry {
	/** Written by the bank (true) or by the user (false). */
	fromBank: boolean
	body: string
	date: string
}

export interface MessageThread {
	id: number
	subject: string
	department: string
	/** Newest first, the way the server sends it. */
	entries: ChatEntry[]
}

/** Opening a conversation also marks the bank's replies as seen. */
export const getMessageThread = async (id: number, isOld: boolean): Promise<MessageThread> => {
	const data = detailSchema.parse(camelKeys(await apiClient<unknown>(`/Chat/Details?id=${String(id)}&isFromOldIb=${String(isOld)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "message failed")
	return {
		id: data.chatHeadId ?? id,
		subject: data.subject ?? "",
		department: data.adminGroupTitle ?? "",
		entries: (data.chats ?? []).map((chat) => ({fromBank: chat.adminUserId !== null && chat.adminUserId !== undefined, body: chat.body ?? "", date: chat.date ?? ""})),
	}
}

const resultSchema = z.object({isSuccessful: z.boolean(), message: text})

export interface MessageResult {
	ok: boolean
	message: string
}

/** Answers a conversation. A refusal (for example, the conversation is full) comes back as `ok: false` with the bank's text. */
export const replyToMessage = async (chatHeadId: number, body: string): Promise<MessageResult> => {
	const data = resultSchema.parse(camelKeys(await apiClient<unknown>("/Chat/AddReply", {method: "POST", body: JSON.stringify({chatHeadId, body})})))
	return {ok: data.isSuccessful, message: data.message ?? ""}
}

const departmentsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: text,
	list: z.array(z.object({id: z.number(), title: text})).nullish(),
})

export interface Department {
	id: number
	title: string
}

/** The departments a new message can be addressed to. */
export const getDepartments = async (): Promise<Department[]> => {
	const data = departmentsSchema.parse(camelKeys(await apiClient<unknown>("/Chat/AdminGroupList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "departments failed")
	return (data.list ?? []).map((item) => ({id: item.id, title: item.title ?? ""}))
}

/** Starts a new conversation. The bank limits how many a user may start per day; that refusal comes back as `ok: false`. */
export const sendMessage = async (params: {departmentId: number; subject: string; body: string}): Promise<MessageResult> => {
	const data = resultSchema.parse(
		camelKeys(await apiClient<unknown>("/Chat/AddMessage", {method: "POST", body: JSON.stringify({adminGroupId: params.departmentId, subject: params.subject, body: params.body})})),
	)
	return {ok: data.isSuccessful, message: data.message ?? ""}
}

/** Hides a conversation from the user (the bank keeps it). */
export const deleteMessage = async (id: number): Promise<MessageResult> => {
	const data = resultSchema.parse(camelKeys(await apiClient<unknown>(`/Chat/DeleteMessage/${String(id)}`)))
	return {ok: data.isSuccessful, message: data.message ?? ""}
}
