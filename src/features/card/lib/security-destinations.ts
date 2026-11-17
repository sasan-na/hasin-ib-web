import {KeyRound} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Dynamic password" menu section and the page each one opens. Services that do not
// have a page yet are added here as they are built.
export const securityDestinations: Record<string, Destination> = {
	CardPasswordChange: {to: routeMap.cardChangePin.path, icon: KeyRound, ...TONES.warning},
}
