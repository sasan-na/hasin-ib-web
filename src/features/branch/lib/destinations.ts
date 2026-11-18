import {FileText, ListChecks, Send, Wallet} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "In-branch services" menu section and the page each one opens. Services that do not
// have a page yet are added here as they are built.
export const branchDestinations: Record<string, Destination> = {
	IntraTransfer: {to: routeMap.branchTransfer.path, icon: Send, ...TONES.primary},
	IntraSendingDoc: {to: routeMap.branchDocuments.path, icon: FileText, ...TONES.info},
	IntraFacilityContract: {to: routeMap.branchFacility.path, icon: Wallet, ...TONES.success},
	IntraInquiry: {to: routeMap.branchRequests.path, icon: ListChecks, ...TONES.info},
}
