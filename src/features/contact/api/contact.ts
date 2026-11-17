import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"

const text = z.string().nullish()

const entrySchema = z.object({name: text, number: text})
const personSchema = z.object({
	id: z.number(),
	name: text,
	family: text,
	mobileNumber: text,
	email: text,
	accountList: z.array(entrySchema).nullish(),
	loanAccountList: z.array(entrySchema).nullish(),
	cardList: z.array(entrySchema).nullish(),
	loanCardList: z.array(entrySchema).nullish(),
	ibanList: z.array(entrySchema).nullish(),
	etcList: z.array(entrySchema).nullish(),
})
const listSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, destinations: z.array(personSchema).nullish()})

/** An account, card, IBAN or toll-tag number saved under a contact, with the user's own title for it. */
export interface ContactEntry {
	name: string
	number: string
}

export interface Contact {
	id: number
	name: string
	family: string
	mobile: string
	email: string
	accounts: ContactEntry[]
	cards: ContactEntry[]
	/** Without the leading "IR". */
	ibans: ContactEntry[]
	/** Kept as the server has them: this client does not edit installment (loan) or toll-tag numbers, but must send them back on a save. */
	loanAccounts: ContactEntry[]
	loanCards: ContactEntry[]
	etcs: ContactEntry[]
}

const entries = (list: {name?: string | null; number?: string | null}[] | null | undefined): ContactEntry[] =>
	(list ?? []).map((item) => ({name: item.name ?? "", number: item.number ?? ""}))

const toContact = (person: z.infer<typeof personSchema>): Contact => ({
	id: person.id,
	name: person.name ?? "",
	family: person.family ?? "",
	mobile: person.mobileNumber ?? "",
	email: person.email ?? "",
	accounts: entries(person.accountList),
	cards: entries(person.cardList),
	ibans: entries(person.ibanList).map((item) => ({...item, number: item.number.replace(/^IR/i, "")})),
	loanAccounts: entries(person.loanAccountList),
	loanCards: entries(person.loanCardList),
	etcs: entries(person.etcList),
})

/** Every saved contact, ordered by family name. */
export const getContacts = async (): Promise<Contact[]> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>("/Destination/GetDestinations")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "contacts failed")
	return (data.destinations ?? []).map(toContact)
}

export const getContact = async (id: number): Promise<Contact> => {
	const data = listSchema.parse(camelKeys(await apiClient<unknown>(`/Destination/GetDestination?id=${String(id)}`)))
	if (data.isSuccessful === false) throw new Error(data.message ?? "contact failed")
	const person = data.destinations?.[0]
	if (!person) throw new Error("contact not found")
	return toContact(person)
}

const limitsSchema = z.object({isSuccessful: z.boolean().nullish(), message: text, accountMax: z.number().nullish(), cardMax: z.number().nullish(), ibanMax: z.number().nullish()})

export interface ContactLimits {
	accounts: number
	cards: number
	ibans: number
}

/** How many accounts, cards and IBANs one contact may hold. */
export const getContactLimits = async (): Promise<ContactLimits> => {
	const data = limitsSchema.parse(camelKeys(await apiClient<unknown>("/Destination/GetDestinationLimitations")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "limits failed")
	return {accounts: data.accountMax ?? 5, cards: data.cardMax ?? 5, ibans: data.ibanMax ?? 5}
}

const saveSchema = z.object({isSuccessful: z.boolean(), message: text, errorCode: z.union([z.string(), z.number()]).nullish()})

export interface SaveResult {
	ok: boolean
	/** A contact with this name and family already exists. */
	duplicate: boolean
	message: string
}

const DUPLICATE_CODE = "150"

const toBody = (contact: Contact) => ({
	id: contact.id,
	name: contact.name,
	family: contact.family,
	mobileNumber: contact.mobile,
	email: contact.email,
	accountList: contact.accounts,
	cardList: contact.cards,
	ibanList: contact.ibans,
	etcList: contact.etcs,
	loanAccountList: contact.loanAccounts,
	loanCardList: contact.loanCards,
})

/**
 * Creates a contact (id 0), or replaces an existing one: the server rebuilds the whole contact from what is sent,
 * so everything the contact holds must be in `contact`. A refusal comes back as `ok: false`; a network failure throws.
 */
export const saveContact = async (contact: Contact): Promise<SaveResult> => {
	const endpoint = contact.id > 0 ? "/Destination/EditDestination" : "/Destination/AddDestination"
	const data = saveSchema.parse(camelKeys(await apiClient<unknown>(endpoint, {method: "POST", body: JSON.stringify(toBody(contact))})))
	return {ok: data.isSuccessful, duplicate: String(data.errorCode ?? "") === DUPLICATE_CODE, message: data.message ?? ""}
}

/** Removes a contact and everything saved under it. */
export const deleteContact = async (id: number): Promise<SaveResult> => {
	const data = saveSchema.parse(camelKeys(await apiClient<unknown>(`/Destination/DeleteDestination?id=${String(id)}`)))
	return {ok: data.isSuccessful, duplicate: false, message: data.message ?? ""}
}
