import {useTranslation} from "react-i18next"

import {loanDestinations} from "@/features/loan/lib/destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The loan section's front page. */
export default function LoanHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Loans" title={t("loan.landing.title")} destinations={loanDestinations} />
}
