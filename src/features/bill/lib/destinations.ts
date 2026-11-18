import {Car, KeyRound, Receipt, ShoppingCart, Smartphone} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Payment services" menu section and the page each one opens. A code with no entry has
// no page here and its card is not shown.
export const paymentDestinations: Record<string, Destination> = {
	BillPayment: {to: routeMap.billList.path, icon: Receipt, ...TONES.primary},
	ETC: {to: routeMap.etcList.path, icon: Car, ...TONES.info},
	ETCPurchase: {to: routeMap.etcPurchase.path, icon: ShoppingCart, ...TONES.info},
	PurchaseVoucher: {to: routeMap.topUp.path, icon: Smartphone, ...TONES.success},
	PayUSSDFee: {to: routeMap.ussd.path, icon: KeyRound, ...TONES.warning},
}
