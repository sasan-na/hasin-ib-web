import {Activity, CalendarDays, ChartLine, Mail, ScrollText} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Reports" menu section and the page each one opens. Services that do not have a
// page yet (such as the income and expense report) are added here as they are built.
export const reportDestinations: Record<string, Destination> = {
	TotalStatement: {to: routeMap.reportStatement.path, icon: ScrollText, ...TONES.primary},
	EventReport: {to: routeMap.reportEvents.path, icon: Activity, ...TONES.warning},
	MonthlyReport: {to: routeMap.reportMonthly.path, icon: CalendarDays, ...TONES.info},
	PeriodicInvoice: {to: routeMap.reportPeriodic.path, icon: Mail, ...TONES.success},
	PeriodicInvoiceNew: {to: routeMap.reportPeriodicNew.path, icon: Mail, ...TONES.success},
	BalanceDiagram: {to: routeMap.reportBalance.path, icon: ChartLine, ...TONES.info},
}
