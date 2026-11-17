import {Mail, Printer, Users} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Other services" menu section and the page each one opens.
export const otherDestinations: Record<string, Destination> = {
	PrintReceipt: {to: routeMap.receiptList.path, icon: Printer, ...TONES.primary},
	Inbox: {to: routeMap.messageList.path, icon: Mail, ...TONES.info},
	PeopleInformation: {to: routeMap.contactList.path, icon: Users, ...TONES.success},
}
