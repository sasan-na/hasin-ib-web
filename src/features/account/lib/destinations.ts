import {Landmark, PiggyBank, ScrollText} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Accounts" menu section and the page each one opens.
export const accountDestinations: Record<string, Destination> = {
	DepositAccountsList: {to: routeMap.accountList.path, icon: Landmark, ...TONES.primary},
	OpenAccount: {to: routeMap.accountNew.path, icon: PiggyBank, ...TONES.success},
	DelegatingAccount: {to: routeMap.accountDelegate.path, icon: ScrollText, ...TONES.info},
}
