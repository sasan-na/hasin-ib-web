import type {Card, CardBalances} from "@/features/card/api/card"
import {normalizeDigits} from "@/lib/normalize-digits"

export interface Filters {
	name: string
	number: string
	/** A category key, or "" for all. */
	category: string
}

export const EMPTY_FILTERS: Filters = {name: "", number: "", category: ""}

export const hasActiveFilters = (filters: Filters): boolean => Object.values(filters).some((value) => value.trim() !== "")

/** The cards that match every filled-in filter. Digits typed in Persian count as the same digits. */
export const filterCards = (cards: Card[], filters: Filters): Card[] => {
	const name = filters.name.trim().toLowerCase()
	const number = normalizeDigits(filters.number).replace(/\s+/g, "")
	return cards.filter(
		(card) =>
			(name === "" || card.name.toLowerCase().includes(name)) &&
			(number === "" || card.number.includes(number)) &&
			(filters.category === "" || card.categoryKey === filters.category),
	)
}

export interface Category {
	key: string
	name: string
}

/** The distinct categories, in the order the server lists them. */
export const categoriesOf = (cards: Card[]): Category[] => {
	const seen = new Map<string, Category>()
	for (const card of cards) {
		if (!seen.has(card.categoryKey)) seen.set(card.categoryKey, {key: card.categoryKey, name: card.categoryName})
	}
	return [...seen.values()]
}

export interface CardGroup extends Category {
	cards: Card[]
}

/** Cards under their category, keeping the server's order for both the groups and what is inside them. */
export const groupCards = (cards: Card[]): CardGroup[] => {
	const groups = new Map<string, CardGroup>()
	for (const card of cards) {
		const group = groups.get(card.categoryKey) ?? {key: card.categoryKey, name: card.categoryName, cards: []}
		group.cards.push(card)
		groups.set(card.categoryKey, group)
	}
	return [...groups.values()]
}

/** The sum of what can be spent across a group, or null when any card's balance is not known yet. */
export const groupTotal = (cards: Card[], fresh: Readonly<Record<number, CardBalances>>): number | null => {
	let total = 0
	for (const card of cards) {
		const available = (fresh[card.id] ?? card.balances).available
		if (available === null) return null
		total += available
	}
	return total
}
