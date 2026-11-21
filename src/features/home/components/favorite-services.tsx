import {useQueries} from "@tanstack/react-query"
import {ArrowRight} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Skeleton} from "@/components/ui/skeleton"
import {accountDestinations} from "@/features/account/lib/destinations"
import {cardDestinations} from "@/features/card/lib/destinations"
import {menuSectionOptions} from "@/features/menu/api/menu.queries"
import type {Destination} from "@/features/menu/components/service-cards"
import {transferDestinations} from "@/features/transfer/lib/destinations"
import {cn} from "@/lib/utils"

// Every menu section the client has pages for, with the pages each of its services opens.
const SECTIONS: {section: string; destinations: Readonly<Record<string, Destination>>}[] = [
	{section: "Accounts", destinations: accountDestinations},
	{section: "Cards", destinations: cardDestinations},
	{section: "TransferMoney", destinations: transferDestinations},
]

/** The services the user starred ("most used") as one row of shortcuts, gathered from every section. */
export function FavoriteServices() {
	const {t, i18n} = useTranslation()
	const sections = useQueries({queries: SECTIONS.map(({section}) => menuSectionOptions(section, i18n.language))})

	const pending = sections.some((query) => query.isPending)
	const tiles = sections.flatMap((query, index) =>
		(query.data ?? []).flatMap((item) => {
			const destination = SECTIONS[index].destinations[item.key]
			return item.isFavorite && destination ? [{item, destination}] : []
		}),
	)

	return (
		<section aria-labelledby="favorite-services-title" className="flex flex-col gap-4 rounded-[2rem] border bg-card p-5 shadow-card sm:p-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 id="favorite-services-title" className="text-base font-semibold">
						{t("home.favorites.title")}
					</h2>
					<p className="mt-1 text-xs text-muted-foreground">{t("home.favorites.subtitle")}</p>
				</div>
				<Link to={routeMap.transfer.path} className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand hover:underline">
					{t("home.favorites.allTransfers")}
					<ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
				</Link>
			</div>
			{pending ? (
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : tiles.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t("home.favorites.empty")}</p>
			) : (
				<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{tiles.map(({item, destination}) => {
						const Icon = destination.icon
						return (
							<li key={item.id}>
								<Link to={destination.to} className="group flex h-full flex-col gap-2 rounded-2xl border bg-card p-4 outline-offset-2 transition-all hover:-translate-y-0.5 hover:border-primary/30">
									<span aria-hidden="true" className={cn("flex size-9 items-center justify-center rounded-full", destination.badge)}>
										<Icon className="size-5" />
									</span>
									<span className="text-sm font-semibold">{item.name}</span>
									{item.description ? <span className="text-xs text-muted-foreground">{item.description}</span> : null}
								</Link>
							</li>
						)
					})}
				</ul>
			)}
		</section>
	)
}
