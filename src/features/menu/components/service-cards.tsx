import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {Star, StarOff, type LucideIcon} from "lucide-react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {setFavorite, type MenuItem} from "@/features/menu/api/menu"
import {menuKeys, menuSectionOptions} from "@/features/menu/api/menu.queries"
import {cn} from "@/lib/utils"

/** Where one of the bank's menu items leads in this client, and how its card is drawn. */
export interface Destination {
	to: string
	icon: LucideIcon
	/** Classes for the round icon. */
	badge: string
	/** Classes for the line beside the title. */
	line: string
}

/** Ready-made colour pairs, so every section's cards use the same palette. */
export const TONES = {
	primary: {badge: "bg-primary-soft text-primary", line: "bg-primary"},
	success: {badge: "bg-success-soft text-success", line: "bg-success"},
	info: {badge: "bg-accent text-accent-foreground", line: "bg-info"},
	warning: {badge: "bg-warning-soft text-warning-foreground", line: "bg-warning"},
} as const

interface ServiceCardProps {
	item: MenuItem
	destination: Destination
	section: string
}

function ServiceCard({item, destination, section}: ServiceCardProps) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const Icon = destination.icon
	const FavoriteIcon = item.isFavorite ? StarOff : Star

	const favorite = useMutation({
		mutationFn: () => setFavorite(item.id, !item.isFavorite),
		onSuccess: () => queryClient.invalidateQueries({queryKey: menuKeys.section(section, i18n.language)}),
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
							<FavoriteIcon aria-hidden="true" className={item.isFavorite ? undefined : "text-brand"} />
							{item.isFavorite ? t("landing.removeFavorite") : t("landing.addFavorite")}
						</Button>
					</div>
					{favorite.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("landing.favoriteError")}
						</p>
					) : null}
				</div>
			) : null}
		</article>
	)
}

interface ServiceCardsProps {
	/** The bank's menu section ("Accounts", "Cards"). */
	section: string
	title: string
	/** The bank's service codes that have a page here. A service the server lists but this client lacks is left out, not shown as a dead end. */
	destinations: Readonly<Record<string, Destination>>
}

/** A section's front page: one card per service the bank offers this user, with an "add to favorites" button. */
export function ServiceCards({section, title, destinations}: ServiceCardsProps) {
	const {t, i18n} = useTranslation()
	const menu = useQuery(menuSectionOptions(section, i18n.language))
	const cards = (menu.data ?? []).flatMap((item) => {
		const destination = destinations[item.key]
		return destination ? [{item, destination}] : []
	})

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{title}</h1>
			{menu.isPending ? (
				<div className="grid gap-6 md:grid-cols-2" aria-hidden="true">
					<Skeleton className="h-52 w-full" />
					<Skeleton className="h-52 w-full" />
				</div>
			) : menu.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{t("landing.error")}
				</p>
			) : cards.length === 0 ? (
				<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("landing.empty")}</p>
			) : (
				<div className="grid gap-6 md:grid-cols-2">
					{cards.map(({item, destination}) => (
						<ServiceCard key={item.id} item={item} destination={destination} section={section} />
					))}
				</div>
			)}
		</div>
	)
}
