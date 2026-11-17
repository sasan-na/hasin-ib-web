import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const groupsSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	permissionGroupModels: z.array(z.object({id: z.number(), name: z.string().nullish(), serviceList: z.array(z.object({id: z.number(), name: z.string().nullish()})).nullish()})).nullish(),
})

export interface PermissionGroup {
	id: number
	name: string
	services: {id: number; name: string}[]
}

/** Everything a role can allow, grouped the way the bank groups it. */
export const getPermissionGroups = async (): Promise<PermissionGroup[]> => {
	const data = groupsSchema.parse(camelKeys(await apiClient<unknown>("/Role/GetPermissionList")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "permissions failed")
	return (data.permissionGroupModels ?? []).map((group) => ({id: group.id, name: group.name ?? "", services: (group.serviceList ?? []).map((service) => ({id: service.id, name: service.name ?? String(service.id)}))}))
}

const rolesSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	roles: z.array(z.object({id: z.number(), name: z.string().nullish(), isAdmin: z.boolean().nullish(), serviceIds: z.array(z.number()).nullish()})).nullish(),
})

/** A set of things a person may do on an account. The bank's own administrator role cannot be changed. */
export interface RoleDefinition {
	id: number
	name: string
	isAdmin: boolean
	serviceIds: number[]
}

export const getRoleDefinitions = async (): Promise<RoleDefinition[]> => {
	const data = rolesSchema.parse(camelKeys(await apiClient<unknown>("/Role/GetSelectedService")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "roles failed")
	return (data.roles ?? []).map((role) => ({id: role.id, name: role.name ?? "", isAdmin: role.isAdmin === true, serviceIds: role.serviceIds ?? []}))
}

const answerSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), alreadyExist: z.boolean().nullish()})

/** Whether another role already has this name (the role being edited, by id, does not count). */
export const roleNameTaken = async (name: string, id: number): Promise<boolean> => {
	const data = answerSchema.parse(camelKeys(await apiClient<unknown>(`/Role/CheckRoleNameDuplication?name=${encodeURIComponent(name)}&id=${String(id)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "role name check failed")
	return data.alreadyExist === true
}

const send = async (path: string, init?: RequestInit): Promise<void> => {
	const data = answerSchema.parse(camelKeys(await apiClient<unknown>(path, init)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "role change failed")
}

/** Creates a role. A real change: send once per confirmation. */
export const createRole = (name: string, serviceIds: number[]): Promise<void> => send("/Role/CreateRole", {method: "POST", body: JSON.stringify({name, serviceIds})})

/** Changes a role's name and what it allows. A real change: send once per confirmation. */
export const editRole = (id: number, name: string, serviceIds: number[]): Promise<void> => send("/Role/EditRole", {method: "POST", body: JSON.stringify({id, name, serviceIds})})

/** Deletes a role. A real change: send once per confirmation. */
export const deleteRole = (id: number): Promise<void> => send(`/Role/RemoveRole/${String(id)}`)
