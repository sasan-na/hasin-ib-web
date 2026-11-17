import {useTranslation} from "react-i18next"

import {paymentDestinations} from "@/features/bill/lib/destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The payment services section's front page. */
export default function PaymentHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="PaymentServices" title={t("payment.landing.title")} destinations={paymentDestinations} />
}
