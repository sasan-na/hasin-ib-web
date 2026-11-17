import {queryOptions} from "@tanstack/react-query"

import {getDepartments, getMessages, getMessageThread} from "./message"

export const messageKeys = {
	all: ["message"] as const,
	list: ["message", "list"] as const,
	thread: (id: number, isOld: boolean) => ["message", "thread", id, isOld] as const,
	departments: ["message", "departments"] as const,
}

export const messagesOptions = () => queryOptions({queryKey: messageKeys.list, queryFn: getMessages, retry: false})

// Opening a conversation marks it as read on the server, so it is never served from a stale cache.
export const messageThreadOptions = (id: number, isOld: boolean) =>
	queryOptions({queryKey: messageKeys.thread(id, isOld), queryFn: () => getMessageThread(id, isOld), staleTime: 0, gcTime: 0, retry: false})

export const departmentsOptions = () => queryOptions({queryKey: messageKeys.departments, queryFn: getDepartments, staleTime: 10 * 60_000, retry: false})
