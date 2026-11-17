import {BookOpen, FileSearch, FileText, GitBranch, Search} from "lucide-react"

import {routeMap} from "@/app/routes"
import {TONES, type Destination} from "@/features/menu/components/service-cards"

// The bank's service codes of the "Cheques" menu section and the page each one opens. Registering, confirming and
// transferring a Pichak cheque start from the cheque list and the inquiry page, so those codes lead there.
export const chequeDestinations: Record<string, Destination> = {
	CurrentAccountList: {to: routeMap.chequeList.path, icon: FileText, ...TONES.primary},
	ChequeBookRequest: {to: routeMap.chequeBook.path, icon: BookOpen, ...TONES.success},
	PichakInquiry: {to: routeMap.pichakInquiry.path, icon: Search, ...TONES.info},
	PichakConfirmation: {to: routeMap.pichakInquiry.path, icon: Search, ...TONES.info},
	PichakTransfer: {to: routeMap.pichakInquiry.path, icon: Search, ...TONES.info},
	PichakRegister: {to: routeMap.chequeList.path, icon: FileText, ...TONES.primary},
	PichakOwnerInquiry: {to: routeMap.pichakOwner.path, icon: FileSearch, ...TONES.warning},
	PichakTransfersChain: {to: routeMap.pichakChain.path, icon: GitBranch, ...TONES.warning},
}
