import {Landmark, PiggyBank, ScrollText} from "lucide-react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {ServiceCards, TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Accounts" menu section and the page each one opens.
const DESTINATIONS: Record<string, Destination> = {
	DepositAccountsList: {to: routeMap.accountList.path, icon: Landmark, ...TONES.primary},
	OpenAccount: {to: routeMap.accountNew.path, icon: PiggyBank, ...TONES.success},
	DelegatingAccount: {to: routeMap.accountDelegate.path, icon: ScrollText, ...TONES.info},
}

/** The account section's front page. */
export default function AccountHomePage() {
	const {t} = useTranslation()
	return <ServiceCards section="Accounts" title={t("account.landing.title")} destinations={DESTINATIONS} />
}
