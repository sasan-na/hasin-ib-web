import type {Account, Balances} from "@/features/account/api/account"
import {normalizeDigits} from "@/lib/normalize-digits"
import {normalizeIban} from "@/lib/format"

export interface Filters {
	name: string
	number: string
	iban: string
	/** A category key, or "" for all. */
	category: string
}

export const EMPTY_FILTERS: Filters = {name: "", number: "", iban: "", category: ""}

export const hasActiveFilters = (filters: Filters): boolean => Object.values(filters).some((value) => value.trim() !== "")

const withoutIranPrefix = (iban: string): string => normalizeIban(iban).replace(/^IR/, "")

/** The accounts that match every filled-in filter. Digits typed in Persian count as the same digits. */
export const filterAccounts = (accounts: Account[], filters: Filters): Account[] => {
	const name = filters.name.trim().toLowerCase()
	const number = normalizeDigits(filters.number).trim()
	const iban = normalizeDigits(filters.iban).replace(/\s+/g, "").toUpperCase().replace(/^IR/, "")

	return accounts.filter(
		(account) =>
			(name === "" || account.name.toLowerCase().includes(name)) &&
			(number === "" || account.number.includes(number)) &&
			(iban === "" || withoutIranPrefix(account.iban).includes(iban)) &&
			(filters.category === "" || account.categoryKey === filters.category),
	)
}

export interface Category {
	key: string
	name: string
}

/** The distinct categories, in the order the server lists them. */
export const categoriesOf = (accounts: Account[]): Category[] => {
	const seen = new Map<string, Category>()
	for (const account of accounts) {
		if (!seen.has(account.categoryKey)) seen.set(account.categoryKey, {key: account.categoryKey, name: account.categoryName})
	}
	return [...seen.values()]
}

export interface AccountGroup extends Category {
	accounts: Account[]
}

/** Accounts under their category, keeping the server's order for both the groups and what is inside them. */
export const groupAccounts = (accounts: Account[]): AccountGroup[] => {
	const groups = new Map<string, AccountGroup>()
	for (const account of accounts) {
		const group = groups.get(account.categoryKey) ?? {key: account.categoryKey, name: account.categoryName, accounts: []}
		group.accounts.push(account)
		groups.set(account.categoryKey, group)
	}
	return [...groups.values()]
}

/**
 * The sum of what can be withdrawn across a group, or null when any account's balance is not known yet
 * (a partial sum would read as a total).
 */
export const groupTotal = (accounts: Account[], fresh: Readonly<Record<number, Balances>>): number | null => {
	let total = 0
	for (const account of accounts) {
		const available = (fresh[account.id] ?? account.balances).available
		if (available === null) return null
		total += available
	}
	return total
}
