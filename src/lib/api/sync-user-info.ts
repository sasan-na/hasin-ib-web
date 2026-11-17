import {queryOptions} from "@tanstack/react-query"

import {z} from "@/lib/zod"

import {apiClient} from "./client"

// "Refresh my list" for accounts and for cards is the same bank call: it re-reads everything the bank holds for
// the user. Only main users may do it, and the server says so through `Allow`.

const allowedSchema = z.object({isSuccessful: z.boolean()})
const resultSchema = z.object({
	isSuccessful: z.boolean(),
	message: z.string().nullish(),
	extendedMessage: z.string().nullish(),
	hasChanged: z.boolean().nullish(),
})

/** Whether this user may refresh their lists from the bank. */
export const canSyncUserInfo = async (): Promise<boolean> => allowedSchema.parse(await apiClient<unknown>("/SyncUserInfo/Allow")).isSuccessful

export interface SyncResult {
	hasChanged: boolean
	/** The bank's own wording of the outcome, in the UI language; may be empty. */
	message: string
}

/** Asks the bank to re-read the user's accounts and cards. Throws with the bank's message when it refuses. */
export const syncUserInfo = async (): Promise<SyncResult> => {
	const data = resultSchema.parse(await apiClient<unknown>("/SyncUserInfo", {method: "POST"}))
	const message = data.extendedMessage ?? data.message ?? ""
	if (!data.isSuccessful) throw new Error(message)
	return {hasChanged: data.hasChanged === true, message}
}

/** Whether the refresh button applies to this user; it is a fact about them, so it is kept. */
export const syncAllowedOptions = () =>
	queryOptions({queryKey: ["sync", "allowed"] as const, queryFn: canSyncUserInfo, staleTime: Infinity, retry: false})
