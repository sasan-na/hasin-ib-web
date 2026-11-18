import {useQuery} from "@tanstack/react-query"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {Skeleton} from "@/components/ui/skeleton"
import {accountDestinations} from "@/features/account/lib/destinations"
import {branchDestinations} from "@/features/branch/lib/destinations"
import {paymentDestinations} from "@/features/bill/lib/destinations"
import {cardDestinations} from "@/features/card/lib/destinations"
import {securityDestinations} from "@/features/card/lib/security-destinations"
import {chequeDestinations} from "@/features/cheque/lib/destinations"
import {dashboardDestinations} from "@/features/dashboard/lib/destinations"
import {loanDestinations} from "@/features/loan/lib/destinations"
import {searchServices} from "@/features/menu/api/search"
import type {Destination} from "@/features/menu/components/service-cards"
import {otherDestinations} from "@/features/menu/lib/other-destinations"
import {reportDestinations} from "@/features/report/lib/destinations"
import {transferDestinations} from "@/features/transfer/lib/destinations"
import {cn} from "@/lib/utils"

// Every page a bank menu item can lead to, by the bank's service code. A service this client has no page for is left out.
const destinations: Record<string, Destination> = {
	...accountDestinations,
	...cardDestinations,
	...transferDestinations,
	...chequeDestinations,
	...loanDestinations,
	...paymentDestinations,
	...reportDestinations,
	...dashboardDestinations,
	...otherDestinations,
	...branchDestinations,
	...securityDestinations,
}

/** Finds the bank's services by what the user types, and opens the one they pick. */
export default function SearchPage() {
	const {t} = useTranslation()
	const [params] = useSearchParams()
	const phrase = (params.get("phrase") ?? "").trim()
	const results = useQuery({queryKey: ["search", phrase], queryFn: () => searchServices(phrase), enabled: phrase.length >= 2, staleTime: 5 * 60_000, retry: false})
	const found = (results.data ?? []).flatMap((item) => (destinations[item.key] ? [{item, destination: destinations[item.key]}] : []))

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("search.title")}</h1>
			<p className="text-sm text-muted-foreground">{phrase === "" ? t("search.prompt") : t("search.for", {phrase})}</p>

			{phrase.length < 2 ? (
				phrase === "" ? null : <p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("search.short")}</p>
			) : results.isPending ? (
				<Skeleton className="h-24 w-full" />
			) : results.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{results.error.message || t("search.error")}
				</p>
			) : found.length === 0 ? (
				<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("search.empty")}</p>
			) : (
				<ul className="grid gap-3 sm:grid-cols-2">
					{found.map(({item, destination}) => {
						const Icon = destination.icon
						return (
							<li key={item.key}>
								<Link to={destination.to} className="flex items-center gap-4 rounded-lg border bg-card p-4 hover:bg-muted/40">
									<span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", destination.badge)}>
										<Icon className="size-5" />
									</span>
									<span className="font-medium">{item.name}</span>
								</Link>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
