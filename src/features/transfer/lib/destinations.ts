import {ArrowLeftRight, CalendarClock, CreditCard, Landmark, Users, Zap} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "TransferMoney" menu section and the page each one opens. Services that do not
// have a page yet are added here as they are built.
export const transferDestinations: Record<string, Destination> = {
	SingleTransferMoney: {to: routeMap.transferSmart.path, icon: ArrowLeftRight, ...TONES.info},
	SatnaTransferMoney: {to: `${routeMap.transferSmart.path}?type=satna`, icon: Zap, ...TONES.primary},
	PayaTransferMoney: {to: `${routeMap.transferSmart.path}?type=paya`, icon: Landmark, ...TONES.success},
	CardTransferMoney: {to: `${routeMap.transferSmart.path}?type=card`, icon: CreditCard, ...TONES.info},
	GroupTransferMoney: {to: routeMap.transferGroup.path, icon: Users, ...TONES.primary},
	StandingOrder: {to: routeMap.transferStandingOrders.path, icon: CalendarClock, ...TONES.warning},
}
