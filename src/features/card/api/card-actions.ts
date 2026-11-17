import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"
import {camelKeys} from "@/lib/api/camel"
import {toTransactionResult, type TransactionResult} from "@/features/transaction/api/transaction"

import {toCardInfoBody, type CardCredentials} from "./card-credentials"

const post = async (endpoint: string, body: unknown): Promise<TransactionResult> =>
	toTransactionResult(await apiClient<unknown>(endpoint, {method: "POST", body: JSON.stringify(body)}))

/**
 * Blocks the card at the bank. The bank treats this as final (a stolen or lost card): it cannot be undone from
 * here. Send it once per confirmation and never retry automatically.
 */
export const blockCard = (cardNumber: string): Promise<TransactionResult> => post("/BlockCard/Block", {cardPan: cardNumber})

// ---- Renewing or replacing a card ---------------------------------------------------------------

const replicaFormSchema = z.object({
	isSuccessful: z.boolean().nullish(),
	message: z.string().nullish(),
	mobileNumber: z.string().nullish(),
	replicaReasons: z.array(z.object({code: z.string(), title: z.string().nullish()})).nullish(),
})

export interface ReplicaForm {
	/** The mobile number the bank has, to pre-fill the form. */
	mobile: string
	/** Why a card may be reissued (lost, damaged, ...). A lost card gets a new number. */
	reasons: {code: string; title: string}[]
}

export const getReplicaForm = async (): Promise<ReplicaForm> => {
	const data = replicaFormSchema.parse(camelKeys(await apiClient<unknown>("/RenewReplicaCard")))
	if (data.isSuccessful === false) throw new Error(data.message ?? "replica form failed")
	return {mobile: data.mobileNumber ?? "", reasons: (data.replicaReasons ?? []).map((reason) => ({code: reason.code, title: reason.title ?? reason.code}))}
}

export interface ReplicaRequest {
	credentials: CardCredentials
	branchCode: string
	mobile: string
}

/**
 * Renews the card: the current one stops working and a new one is collected at the branch. A real change to
 * the card, so it is sent once per confirmation and never retried automatically.
 */
export const renewCard = (request: ReplicaRequest): Promise<TransactionResult> =>
	post("/RenewReplicaCard/Renew", {mobileNumber: request.mobile, branchCode: request.branchCode, cardInfo: toCardInfoBody(request.credentials)})

/** Reissues the card (a replacement, with a reason). Same care as `renewCard`. */
export const reissueCard = (request: ReplicaRequest & {reason: string}): Promise<TransactionResult> =>
	post("/RenewReplicaCard/Replica", {
		mobileNumber: request.mobile,
		branchCode: request.branchCode,
		replicaReason: request.reason,
		cardInfo: toCardInfoBody(request.credentials),
	})

// ---- Saving the card's CVV2 and expiry with the bank ---------------------------------------------

const resultSchema = z.object({isSuccessful: z.boolean(), message: z.string().nullish()})

const editCardInfo = async (body: unknown): Promise<void> => {
	const data = resultSchema.parse(await apiClient<unknown>("/CardInfo/EditCardInfo", {method: "POST", body: JSON.stringify(body)}))
	if (!data.isSuccessful) throw new Error(data.message ?? "")
}

/**
 * Has the bank keep the card's CVV2 and expiry, so later card requests can pre-fill them. The bank checks the
 * card first with the password given here; the password and OTP themselves are not kept. Throws with the bank's text.
 */
export const saveCardInfo = (cardId: number, credentials: CardCredentials): Promise<void> =>
	editCardInfo({
		saveCardInfo: true,
		userCardId: cardId,
		pan: credentials.pan,
		pin2: credentials.pin2,
		otp: credentials.otp,
		cvv2: credentials.cvv2,
		expirationYear: credentials.expiryYear,
		expirationMonth: credentials.expiryMonth,
	})

/** Makes the bank forget the CVV2 and expiry it saved for the card. */
export const deleteSavedCardInfo = (cardId: number): Promise<void> =>
	editCardInfo({saveCardInfo: false, userCardId: cardId, pan: null, pin2: null, otp: null, cvv2: null, expirationYear: null, expirationMonth: null})
