import {useTranslation} from "react-i18next"

import {chequeDestinations} from "@/features/cheque/lib/destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The cheque section's front page. */
export default function ChequeHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Cheques" title={t("cheque.landing.title")} destinations={chequeDestinations} />
}
