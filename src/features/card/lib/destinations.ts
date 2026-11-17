import {Banknote, ClipboardList, CreditCard, Gift} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Cards" menu section and the page each one opens. Services that do not have a
// page yet are added here as they are built.
export const cardDestinations: Record<string, Destination> = {
	CardsList: {to: routeMap.cardList.path, icon: CreditCard, ...TONES.primary},
	GiftCard: {to: routeMap.cardGift.path, icon: Gift, ...TONES.success},
	CardlessList: {to: routeMap.cardlessList.path, icon: Banknote, ...TONES.info},
	BatchCardlessCashStatus: {to: routeMap.cardlessList.path, icon: Banknote, ...TONES.info},
	Cardless: {to: routeMap.cardlessNew.path, icon: Banknote, ...TONES.info},
	CardlessRequest: {to: routeMap.cardlessNew.path, icon: Banknote, ...TONES.info},
	ListOfCardRequests: {to: routeMap.cardRequestList.path, icon: ClipboardList, ...TONES.warning},
}
