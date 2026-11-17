import {ArrowLeftRight, CalendarClock, CreditCard, Landmark, Zap} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "TransferMoney" menu section and the page each one opens. Services that do not
// have a page yet are added here as they are built.
export const transferDestinations: Record<string, Destination> = {
	SingleTransferMoney: {to: routeMap.transferSmart.path, icon: ArrowLeftRight, ...TONES.info},
	SatnaTransferMoney: {to: `${routeMap.transferIban.path}?type=satna`, icon: Zap, ...TONES.primary},
	PayaTransferMoney: {to: `${routeMap.transferIban.path}?type=paya`, icon: Landmark, ...TONES.success},
	CardTransferMoney: {to: routeMap.transferCard.path, icon: CreditCard, ...TONES.info},
	StandingOrder: {to: routeMap.transferStandingOrders.path, icon: CalendarClock, ...TONES.warning},
}
