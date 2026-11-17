import {useTranslation} from "react-i18next"

import {ServiceCards} from "@/features/menu/components/service-cards"
import {reportDestinations} from "@/features/report/lib/destinations"

/** The report section's front page. */
export default function ReportHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Reports" title={t("report.landing.title")} destinations={reportDestinations} />
}
