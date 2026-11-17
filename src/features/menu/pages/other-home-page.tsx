import {useTranslation} from "react-i18next"

import {ServiceCards} from "@/features/menu/components/service-cards"
import {otherDestinations} from "@/features/menu/lib/other-destinations"

/** The other services section's front page. */
export default function OtherHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="OtherServices" title={t("other.landing.title")} destinations={otherDestinations} />
}
