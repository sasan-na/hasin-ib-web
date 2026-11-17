import {CreditCard} from "lucide-react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {ServiceCards, TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Cards" menu section and the page each one opens. Services that do not have a
// page yet are added here as they are built.
const DESTINATIONS: Record<string, Destination> = {
	CardsList: {to: routeMap.cardList.path, icon: CreditCard, ...TONES.primary},
}

/** The card section's front page. */
export default function CardHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Cards" title={t("card.landing.title")} destinations={DESTINATIONS} />
}
