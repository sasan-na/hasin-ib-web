import {ClipboardCheck, ListChecks, UserCog} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Dashboard" menu section and the page each one opens. Role management has no page yet.
export const dashboardDestinations: Record<string, Destination> = {
	Dashboard: {to: routeMap.dashboard.path, icon: ClipboardCheck, ...TONES.primary},
	Workflow: {to: routeMap.workflowRules.path, icon: ListChecks, ...TONES.info},
	UserManagement: {to: routeMap.subUsers.path, icon: UserCog, ...TONES.success},
}
