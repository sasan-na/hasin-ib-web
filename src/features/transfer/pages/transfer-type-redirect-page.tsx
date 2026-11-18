import {Navigate, useLocation, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"

/** The old addresses for card and IBAN transfers (/transfer/card, /transfer/iban?type=paya) lead to the one transfer page. */
export default function TransferTypeRedirectPage() {
	const {pathname} = useLocation()
	const [params] = useSearchParams()
	const type = pathname === routeMap.transferCard.path ? "card" : params.get("type") === "paya" ? "paya" : "satna"
	return <Navigate to={`${routeMap.transferSmart.path}?type=${type}`} replace />
}
