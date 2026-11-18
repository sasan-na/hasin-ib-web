import {useQuery} from "@tanstack/react-query"

import {PayeeChips} from "@/components/flow/flow-form"
import type {DestinationKind} from "@/features/transfer/api/destinations"
import {savedDestinationsOptions} from "@/features/transfer/api/transfer.queries"

interface PayeeShortcutsProps {
	/** Which kind of number to offer: the server keeps a separate list of saved destinations for each. */
	kind: DestinationKind
	/** Gets the number to fill in. */
	onPick: (number: string) => void
}

/** The user's saved destinations of one kind (account, card or IBAN), as pills under the destination field. */
export function PayeeShortcuts({kind, onPick}: PayeeShortcutsProps) {
	const saved = useQuery(savedDestinationsOptions(kind))
	const payees = (saved.data ?? []).filter((payee) => payee.holder !== "").map((payee) => ({key: payee.key, name: payee.holder, number: payee.number}))
	return <PayeeChips payees={payees} onPick={onPick} />
}
