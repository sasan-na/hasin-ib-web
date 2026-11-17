import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const listSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	subUsers: z.array(z.object({id: z.number(), username: z.string().nullish(), type: z.union([z.number(), z.string()]).nullish(), name: z.string().nullish(), isActive: z.boolean().nullish()})).nullish(),
})

/** 0: signs for the account, 1: a registered user of the bank, 2: a sub-user the account holder created. */
export type SubUserKind = 0 | 1 | 2

export interface SubUser {
	id: number
	username: string
	name: string
	kind: SubUserKind
	active: boolean
}

const kindOf = (value: number | string | null | undefined): SubUserKind => {
	if (value === 1 || value === "1" || value === "RegisteredUser") return 1
	if (value === 2 || value === "2" || value === "SubUser" || value === "Subset") return 2
	return 0
}

/** The people who act on the user's accounts. */
export const getSubUsers = async (): Promise<SubUser[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/SubUser/GetSubUsers")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "sub-users failed")
	return (data.subUsers ?? []).map((user) => ({id: user.id, username: user.username ?? "", name: user.name ?? "", kind: kindOf(user.type), active: user.isActive !== false}))
}

const workflowsSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), workflows: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish()})

/** The approval rules a person is part of. Someone who is in any cannot be disabled or removed until those rules change. */
export const getSubUserRules = async (username: string): Promise<{id: number; name: string}[]> => {
	const data = workflowsSchema.parse(camelKeys(await apiClient<unknown>(`/SubUser/GetSubUserWorkflows?username=${encodeURIComponent(username)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "sub-user rules failed")
	return (data.workflows ?? []).map((rule) => ({id: rule.id, name: rule.name ?? ""}))
}

const answerSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish()})

const change = async (path: string, username: string): Promise<string> => {
	const data = answerSchema.parse(camelKeys(await apiClient<unknown>(path, {method: "POST", body: JSON.stringify({username})})))
	if (data.isSuccessful === false) throw new Error(data.message ?? "sub-user change failed")
	return data.message ?? ""
}

/** Disables a sub-user. A real change: send once per confirmation. */
export const disableSubUser = (username: string): Promise<string> => change("/SubUser/DisableSubUser", username)
/** Enables a disabled sub-user. A real change: send once per confirmation. */
export const enableSubUser = (username: string): Promise<string> => change("/SubUser/EnableSubUser", username)
/** Removes a registered user from the account holder's people. A real change: send once per confirmation. */
export const removeExistingUser = (username: string): Promise<string> => change("/SubUser/RemoveExistingUser", username)
