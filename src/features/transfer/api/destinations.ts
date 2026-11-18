import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()

const itemSchema = z.object({id: z.number().nullish(), name: text, number: text})
const personSchema = z.object({id: z.union([z.string(), z.number()]).nullish(), nameFamily: text, items: z.array(itemSchema).nullish()})
const listSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, destinations: z.array(personSchema).nullish()})

/** Which kind of number a transfer goes to. Each kind has its own list of saved destinations on the server. */
export type DestinationKind = "accounts" | "cards" | "ibans"

// The three lists the old client asked for when its account/card/IBAN picker opened, one per kind of transfer.
const PATHS: Record<DestinationKind, string> = {
	accounts: "/Destination/GetAccountDestinations?isLoan=false",
	cards: "/Destination/GetCardDestinations?isLoan=false",
	ibans: "/Destination/GetIbanDestinations",
}

/** One saved number and the person it belongs to. */
export interface SavedDestination {
	key: string
	holder: string
	/** The user's own title for this number; may be empty. */
	title: string
	/** An IBAN comes without its leading "IR". */
	number: string
}

export const getSavedDestinations = async (kind: DestinationKind): Promise<SavedDestination[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>(PATHS[kind])))
	if (data.isSuccessful === false) throw new Error(data.message ?? "destinations failed")
	return (data.destinations ?? []).flatMap((person) =>
		(person.items ?? []).flatMap((item, index) => {
			const number = (item.number ?? "").replace(/^IR/i, "")
			const holder = (person.nameFamily ?? "").trim()
			return number === "" ? [] : [{key: `${String(person.id ?? holder)}-${String(item.id ?? index)}`, holder, title: item.name ?? "", number}]
		}),
	)
}
