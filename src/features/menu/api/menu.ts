import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

// The bank's menu is data: each section has items with a name, a description and whether the user pinned
// them as favourites. The server already leaves out what this user may not use.

const menuSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	menuItemList: z
		.array(
			z.object({
				id: z.number(),
				key: z.string(),
				name: z.string().nullish(),
				description: z.string().nullish(),
				isCommon: z.boolean().nullish(),
				canBeCommon: z.boolean().nullish(),
			}),
		)
		.nullish(),
})

export interface MenuItem {
	id: number
	/** The bank's code for the service ("OpenAccount"); this is what maps to a page. */
	key: string
	name: string
	description: string
	canBeFavorite: boolean
	isFavorite: boolean
}

const fetchSection = async (parentKey: string): Promise<MenuItem[]> => {
	const data = menuSchema.parse(camelKeys(await apiClient<unknown>(`/Menu/GetMenuItem?parentKey=${encodeURIComponent(parentKey)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "menu failed")
	return (data.menuItemList ?? []).map((item) => ({
		id: item.id,
		key: item.key,
		name: item.name ?? item.key,
		description: item.description ?? "",
		canBeFavorite: item.canBeCommon === true,
		isFavorite: item.isCommon === true,
	}))
}

/**
 * The items of one menu section. Business (legal-entity) users have their own copy of each section, named
 * "Legal" plus the name; the client does not know which kind of user this is, so when the personal section
 * comes back empty the business one is tried.
 */
export const getMenuSection = async (section: string): Promise<MenuItem[]> => {
	const personal = await fetchSection(section)
	return personal.length > 0 ? personal : fetchSection(`Legal${section}`)
}

const resultSchema = z.object({isSuccessful: z.boolean(), message: z.string().nullish()})

/** Pins or unpins a menu item as a favourite ("most used"). Throws when the server refuses. */
export const setFavorite = async (itemId: number, favorite: boolean): Promise<void> => {
	const data = resultSchema.parse(
		camelKeys(
			await apiClient<unknown>(favorite ? "/Menu/AddCommon" : "/Menu/RemoveCommon", {
				method: "POST",
				body: JSON.stringify({subMenuItem: itemId}),
			}),
		),
	)
	if (!data.isSuccessful) throw new Error(data.message ?? "favorite failed")
}
