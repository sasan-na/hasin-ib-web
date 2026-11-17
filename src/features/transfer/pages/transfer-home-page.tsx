import {ArrowLeftRight, CalendarClock} from "lucide-react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {ServiceCards, TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "TransferMoney" menu section and the page each one opens. Services that do not
// have a page yet are added here as they are built.
const DESTINATIONS: Record<string, Destination> = {
	SingleTransferMoney: {to: routeMap.transferSmart.path, icon: ArrowLeftRight, ...TONES.info},
	StandingOrder: {to: routeMap.transferStandingOrders.path, icon: CalendarClock, ...TONES.warning},
}

/** The transfer section's front page. */
export default function TransferHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="TransferMoney" title={t("transfer.landing.title")} destinations={DESTINATIONS} />
}
