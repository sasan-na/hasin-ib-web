import {useTranslation} from "react-i18next"

import {transferDestinations} from "@/features/transfer/lib/destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The transfer section's front page. */
export default function TransferHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="TransferMoney" title={t("transfer.landing.title")} destinations={transferDestinations} />
}
