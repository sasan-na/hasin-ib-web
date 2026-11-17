import {queryOptions} from "@tanstack/react-query"

import {getReplicaForm} from "./card-actions"
import {getGiftCardConfig} from "./gift-card"
import {getCardAccounts, getAddableAccounts} from "./card-account"
import {getCardCredentialInfo} from "./card-credentials"
import {getCardInfo, getCardOwner} from "./card-info"
import {getCards} from "./card"
import {getCardlessConfig, getCardlessTickets} from "./cardless"

// Card names and types come from the server in the UI language, so the language is part of the key.
export const cardKeys = {
	all: ["card"] as const,
	list: (language: string) => [...cardKeys.all, "list", language] as const,
	info: (cardId: number) => [...cardKeys.all, "info", cardId] as const,
	owner: (cardId: number) => [...cardKeys.all, "owner", cardId] as const,
	accounts: (cardId: number) => [...cardKeys.all, "accounts", cardId] as const,
	addable: (cardId: number, linked: string) => [...cardKeys.all, "addable", cardId, linked] as const,
	credentials: (cardId: number, language: string) => [...cardKeys.all, "credentials", cardId, language] as const,
	replicaForm: (language: string) => [...cardKeys.all, "replicaForm", language] as const,
	giftConfig: () => [...cardKeys.all, "giftConfig"] as const,
	cardless: ["card", "cardless"] as const,
}

export const cardsOptions = (language: string) => queryOptions({queryKey: cardKeys.list(language), queryFn: getCards, staleTime: 60_000, retry: false})

export const cardInfoOptions = (cardId: number) => queryOptions({queryKey: cardKeys.info(cardId), queryFn: () => getCardInfo(cardId), retry: false})

/** The holder's name and photo: slow to come, so it is its own query and the page does not wait for it. */
export const cardOwnerOptions = (cardId: number) =>
	queryOptions({queryKey: cardKeys.owner(cardId), queryFn: () => getCardOwner(cardId), staleTime: 5 * 60_000, retry: false})

/** The accounts linked to the card. Never served from cache for long: it is what a change has just altered. */
export const cardAccountsOptions = (cardId: number) => queryOptions({queryKey: cardKeys.accounts(cardId), queryFn: () => getCardAccounts(cardId), staleTime: 0, retry: false})

export const addableAccountsOptions = (cardId: number, linked: string[]) =>
	queryOptions({queryKey: cardKeys.addable(cardId, linked.join(",")), queryFn: () => getAddableAccounts(cardId, linked), staleTime: 0, retry: false})

/** Whether the card needs a token's password, and the CVV2/expiry the user saved, if any. */
export const cardCredentialInfoOptions = (cardId: number, language: string) =>
	queryOptions({queryKey: cardKeys.credentials(cardId, language), queryFn: () => getCardCredentialInfo(cardId), staleTime: 0, retry: false})

/** The mobile number the bank has and the reasons a card may be reissued. */
export const replicaFormOptions = (language: string) =>
	queryOptions({queryKey: cardKeys.replicaForm(language), queryFn: getReplicaForm, staleTime: 5 * 60_000, retry: false})

/** The bank's limits for gift cards (how many, how much, in what steps, and the fee). */
export const giftCardConfigOptions = () =>
	queryOptions({queryKey: cardKeys.giftConfig(), queryFn: getGiftCardConfig, staleTime: 5 * 60_000, retry: false})

/** The card-less withdrawal tickets of every card; the bank asks its core system, so a minute of cache and a refresh button. */
export const cardlessTicketsOptions = () => queryOptions({queryKey: [...cardKeys.cardless, "tickets"], queryFn: getCardlessTickets, staleTime: 60_000, retry: false})

export const cardlessConfigOptions = () => queryOptions({queryKey: [...cardKeys.cardless, "config"], queryFn: getCardlessConfig, staleTime: 5 * 60_000, retry: false})
