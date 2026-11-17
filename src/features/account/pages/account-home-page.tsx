import {useTranslation} from "react-i18next"

import {accountDestinations} from "@/features/account/lib/destinations"
import {ServiceCards} from "@/features/menu/components/service-cards"

/** The account section's front page. */
export default function AccountHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Accounts" title={t("account.landing.title")} destinations={accountDestinations} />
}
