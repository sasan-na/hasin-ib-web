import {Car, KeyRound, Receipt} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Payment services" menu section and the page each one opens. Buying a toll tag,
// USSD fees and vouchers have no page yet.
export const paymentDestinations: Record<string, Destination> = {
	BillPayment: {to: routeMap.billList.path, icon: Receipt, ...TONES.primary},
	ETC: {to: routeMap.etcList.path, icon: Car, ...TONES.info},
	PayUSSDFee: {to: routeMap.ussd.path, icon: KeyRound, ...TONES.warning},
}
