import {useTranslation} from "react-i18next"

import {branchDestinations} from "@/features/branch/lib/destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The in-branch services section's front page. */
export default function BranchHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Intra" title={t("branch.landing.title")} destinations={branchDestinations} />
}
