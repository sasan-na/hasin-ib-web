import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {Landmark, PiggyBank, ScrollText, Star, StarOff, type LucideIcon} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {setFavorite, type MenuItem} from "@/lib/api/menu"
import {menuKeys, menuSectionOptions} from "@/lib/api/menu.queries"
import {cn} from "@/lib/utils"
import {routeMap} from "@/app/routes"

/** The bank's menu section these cards belong to. */
const SECTION = "Accounts"

interface Destination {
	to: string
	icon: LucideIcon
	/** Classes for the round icon and the line beside the title. */
	badge: string
	line: string
}

// The bank's service codes that have a page here. An item the server lists but this client does not have yet
// is left out rather than shown as a dead end.
const DESTINATIONS: Record<string, Destination> = {
	DepositAccountsList: {to: routeMap.accountList.path, icon: Landmark, badge: "bg-primary text-primary-foreground", line: "bg-primary"},
	OpenAccount: {to: routeMap.accountNew.path, icon: PiggyBank, badge: "bg-success text-white dark:text-background", line: "bg-success"},
	DelegatingAccount: {to: routeMap.accountDelegate.path, icon: ScrollText, badge: "bg-info text-white dark:text-background", line: "bg-info"},
}

function ServiceCard({item, destination}: {item: MenuItem; destination: Destination}) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const Icon = destination.icon
	const FavoriteIcon = item.isFavorite ? StarOff : Star

	const favorite = useMutation({
		mutationFn: () => setFavorite(item.id, !item.isFavorite),
		onSuccess: () => queryClient.invalidateQueries({queryKey: menuKeys.section(SECTION, i18n.language)}),
	})

	return (
		<article className="flex flex-col overflow-hidden rounded-lg border bg-card">
			<Link to={destination.to} className="flex flex-1 flex-col gap-5 p-5 outline-offset-[-2px] hover:bg-muted/40">
				<div className="flex items-center gap-4">
					<h2 className="text-lg font-semibold">{item.name}</h2>
					<span aria-hidden="true" className={cn("h-0.5 flex-1", destination.line)} />
					<span aria-hidden="true" className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", destination.badge)}>
						<Icon className="size-6" />
					</span>
				</div>
				<p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
			</Link>
			{item.canBeFavorite ? (
				<div className="flex flex-col gap-2 px-5 pb-5">
					<div>
						<Button type="button" variant="outline" size="sm" disabled={favorite.isPending} onClick={() => favorite.mutate()}>
							<FavoriteIcon aria-hidden="true" className={item.isFavorite ? undefined : "text-primary"} />
							{item.isFavorite ? t("account.landing.removeFavorite") : t("account.landing.addFavorite")}
						</Button>
					</div>
					{favorite.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("account.landing.favoriteError")}
						</p>
					) : null}
				</div>
			) : null}
		</article>
	)
}

/** The account section's front page: one card per service the bank offers this user. */
export default function AccountHomePage() {
	const {t, i18n} = useTranslation()
	const menu = useQuery(menuSectionOptions(SECTION, i18n.language))
	const cards = (menu.data ?? []).flatMap((item) => {
		const destination = DESTINATIONS[item.key]
		return destination ? [{item, destination}] : []
	})

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("account.landing.title")}</h1>
			{menu.isPending ? (
				<div className="grid gap-6 md:grid-cols-2" aria-hidden="true">
					<Skeleton className="h-52 w-full" />
					<Skeleton className="h-52 w-full" />
				</div>
			) : menu.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{t("account.landing.error")}
				</p>
			) : cards.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("account.landing.empty")}</p>
			) : (
				<div className="grid gap-6 md:grid-cols-2">
					{cards.map(({item, destination}) => (
						<ServiceCard key={item.id} item={item} destination={destination} />
					))}
				</div>
			)}
		</div>
	)
}
