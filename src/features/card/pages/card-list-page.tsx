import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {RefreshCw} from "lucide-react"
import {useMemo, useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {moveCard, type CardBalances} from "@/features/card/api/card"
import {cardKeys, cardsOptions} from "@/features/card/api/card.queries"
import {CardFilters} from "@/features/card/components/card-filters"
import {CardRow} from "@/features/card/components/card-row"
import {categoriesOf, EMPTY_FILTERS, filterCards, groupCards, groupTotal, hasActiveFilters, type Filters} from "@/features/card/lib/card-list"
import {formatAmount} from "@/lib/format"
import {syncAllowedOptions, syncUserInfo} from "@/lib/api/sync-user-info"

/** The user's cards, grouped by category, with search, on-request balances and reordering. */
export default function CardListPage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const cards = useQuery(cardsOptions(i18n.language))
	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
	// Balances fetched during this visit, by card id; they also feed the group totals.
	const [fresh, setFresh] = useState<Readonly<Record<number, CardBalances>>>({})
	const [moveFailed, setMoveFailed] = useState(false)

	const move = useMutation({
		mutationFn: ({sourceId, destinationId}: {sourceId: number; destinationId: number}) => moveCard(sourceId, destinationId),
		onMutate: () => setMoveFailed(false),
		onError: () => setMoveFailed(true),
		// Success or not, the server's order is the truth.
		onSettled: () => queryClient.invalidateQueries({queryKey: cardKeys.all}),
	})

	const syncAllowed = useQuery(syncAllowedOptions())
	const sync = useMutation({
		mutationFn: syncUserInfo,
		// A changed list means the old one (and its order) is stale.
		onSuccess: (result) => (result.hasChanged ? queryClient.invalidateQueries({queryKey: cardKeys.all}) : undefined),
	})

	const filtering = hasActiveFilters(filters)
	const all = cards.data
	const groups = useMemo(() => (all ? groupCards(filterCards(all, filters)) : []), [all, filters])
	const categories = useMemo(() => (all ? categoriesOf(all) : []), [all])

	const recordFresh = (cardId: number, balances: CardBalances): void => setFresh((current) => ({...current, [cardId]: balances}))

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("card.listTitle")}</h1>
				{syncAllowed.data ? (
					<Button type="button" variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>
						<RefreshCw aria-hidden="true" className={sync.isPending ? "animate-spin" : undefined} />
						{sync.isPending ? t("card.syncing") : t("card.sync")}
					</Button>
				) : null}
			</div>
			{sync.isSuccess ? (
				<p role="status" className="text-sm text-muted-foreground">
					{sync.data.message || (sync.data.hasChanged ? t("card.syncChanged") : t("card.syncUnchanged"))}
				</p>
			) : null}
			{sync.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{sync.error.message || t("card.syncError")}
				</p>
			) : null}

			{cards.isPending ? (
				<div className="flex flex-col gap-3 rounded-lg border bg-card p-5" aria-hidden="true">
					<Skeleton className="h-16 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : cards.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{t("card.error")}
				</p>
			) : cards.data.length === 0 ? (
				<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("card.empty")}</p>
			) : (
				<>
					<CardFilters filters={filters} onChange={setFilters} onReset={() => setFilters(EMPTY_FILTERS)} categories={categories} />

					{moveFailed ? (
						<p role="alert" className="text-sm text-destructive">
							{t("card.moveError")}
						</p>
					) : null}

					{groups.length === 0 ? (
						<p className="rounded-lg bg-card p-5 text-sm text-muted-foreground">{t("card.noResults")}</p>
					) : (
						groups.map((group) => {
							const total = groupTotal(group.cards, fresh)
							const headingId = `card-group-${group.key || "none"}`
							return (
								<section key={group.key} aria-labelledby={headingId} className="overflow-hidden rounded-lg bg-card">
									<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-muted/60 px-5 py-3">
										<h2 id={headingId} className="text-base font-semibold">
											{group.name || t("card.listTitle")}
										</h2>
										{total !== null ? (
											<span className="text-sm text-muted-foreground">
												{t("card.groupTotal")}{" "}
												<span className="font-semibold text-foreground tabular-nums">
													{formatAmount(total, i18n.language)} {t("card.rial")}
												</span>
											</span>
										) : null}
									</div>
									<ul className="divide-y">
										{group.cards.map((card, index) => (
											<CardRow
												key={card.id}
												card={card}
												fresh={fresh[card.id]}
												onFresh={recordFresh}
												move={
													filtering
														? undefined
														: {
																canMoveUp: index > 0,
																canMoveDown: index < group.cards.length - 1,
																busy: move.isPending,
																onMove: (direction) => {
																	const target = group.cards[direction === "up" ? index - 1 : index + 1]
																	move.mutate({sourceId: card.id, destinationId: target.id})
																},
															}
												}
											/>
										))}
									</ul>
								</section>
							)
						})
					)}
				</>
			)}
		</div>
	)
}
