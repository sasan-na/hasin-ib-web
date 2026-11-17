import {useTranslation} from "react-i18next"

import {securityDestinations} from "@/features/card/lib/security-destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The dynamic password section's front page. */
export default function SecurityHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="DynamicPassword" title={t("security.landing.title")} destinations={securityDestinations} />
}
