import {useTranslation} from "react-i18next"

import {dashboardDestinations} from "@/features/dashboard/lib/destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The dashboard (approvals) section's front page. */
export default function DashboardHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Dashboard" title={t("dashboard.landing.title")} destinations={dashboardDestinations} />
}
