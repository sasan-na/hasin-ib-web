import {useTranslation} from "react-i18next"

import {cardDestinations} from "@/features/card/lib/destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The card section's front page. */
export default function CardHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Cards" title={t("card.landing.title")} destinations={cardDestinations} />
}
