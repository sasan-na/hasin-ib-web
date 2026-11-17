import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const schema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	searchItems: z.array(z.object({key: z.string().nullish(), name: z.string().nullish(), isMenuItem: z.boolean().nullish()})).nullish(),
})

export interface SearchHit {
	/** The bank's service code, the same one its menu sections use. */
	key: string
	name: string
}

/** The bank's services whose name or description holds the phrase (the bank searches its Persian texts). */
export const searchServices = async (phrase: string): Promise<SearchHit[]> => {
	const data = schema.parse(camelKeys(await apiClient<unknown>(`/Search?phrase=${encodeURIComponent(phrase)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "search failed")
	return (data.searchItems ?? []).flatMap((item) => (item.isMenuItem === true && item.key ? [{key: item.key, name: item.name ?? item.key}] : []))
}
