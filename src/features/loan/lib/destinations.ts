import {Calculator, HandCoins, Home, Users} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Loans" menu section and the page each one opens. Services that do not have a
// page yet are added here as they are built.
export const loanDestinations: Record<string, Destination> = {
	LoanPayment: {to: routeMap.loanList.path, icon: HandCoins, ...TONES.primary},
	InstallmentInterest: {to: routeMap.loanInterest.path, icon: Calculator, ...TONES.info},
	JuniorDepositInstallmentInterest: {to: routeMap.loanJunior.path, icon: Home, ...TONES.warning},
	OtherLoan: {to: routeMap.loanOther.path, icon: Users, ...TONES.success},
}
