/** What another page may hand to the transfer page so the user does not type it twice. Nothing here is trusted: the page re-checks it. */
export interface TransferPrefill {
	sourceId: number | null
	destination: string
	/** Rials, digits only. */
	amount: string
}

/** Reads router state as a prefill, ignoring anything that is not the expected shape. */
export const readPrefill = (state: unknown): TransferPrefill | null => {
	if (typeof state !== "object" || state === null) return null
	const {sourceId, destination, amount} = state as Record<string, unknown>
	if (typeof destination !== "string" || typeof amount !== "string") return null
	return {sourceId: typeof sourceId === "number" ? sourceId : null, destination: /^\d{0,15}$/.test(destination) ? destination : "", amount: /^\d{0,15}$/.test(amount) ? amount : ""}
}
