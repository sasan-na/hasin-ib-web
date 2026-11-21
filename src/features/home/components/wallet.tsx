import {useMutation, useQuery} from "@tanstack/react-query"
import {ChevronLeft, ChevronRight, CreditCard, Eye, Landmark, Plus, WalletCards} from "lucide-react"
import {useEffect, useRef, useState, type ReactNode} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {CopyButton} from "@/components/copy-button"
import {Button} from "@/components/ui/button"
import {Skeleton} from "@/components/ui/skeleton"
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs"
import {getBalance} from "@/features/account/api/account"
import {accountsOptions} from "@/features/account/api/account.queries"
import {getCardBalance} from "@/features/card/api/card"
import {cardsOptions} from "@/features/card/api/card.queries"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {cn} from "@/lib/utils"
import {MASK, usePrivacyStore} from "@/store/privacy"

interface TileProps {
	name: string
	kind: "account" | "card"
	number: string
	/** The number as shown; accounts keep it plain, cards in groups of four. */
	display: string
	/** What the list already carried. */
	balance: number | null
	/** Fetches a fresh balance; absent when the user may not see one. */
	fetchBalance?: () => Promise<number | null>
	featured: boolean
}

/** One account or card as a tile: its name, its number with copy, and its balance on request. */
function Tile({name, kind, number, display, balance, fetchBalance, featured}: TileProps) {
	const {t, i18n} = useTranslation()
	const hidden = usePrivacyStore((s) => s.hidden)
	const reveal = useMutation({mutationFn: async () => (fetchBalance ? fetchBalance() : null)})
	const shown = reveal.data ?? balance
	const Icon = kind === "account" ? Landmark : CreditCard

	return (
		<li className={cn("flex min-h-40 min-w-0 flex-col justify-between gap-5 rounded-2xl border p-4 transition-colors", featured ? "border-primary/20 bg-primary-soft/60" : "bg-muted/30 hover:bg-muted/50")}>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", featured ? "bg-card text-primary shadow-sm" : "bg-primary-soft text-primary")}>
						<Icon aria-hidden="true" className="size-4" />
					</span>
					<h3 className="min-w-0 text-sm font-semibold wrap-break-word">{name}</h3>
				</div>
				<CopyButton value={number} label={t("home.wallet.copy")} />
			</div>
			<div className="flex flex-col gap-2">
				<p dir="ltr" className="truncate text-start text-xs tracking-wide text-muted-foreground tabular-nums">
					{display}
				</p>
				{fetchBalance || shown !== null ? (
					<div className="flex items-center justify-between gap-2" aria-live="polite">
						{fetchBalance ? (
							<button
								type="button"
								className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
								disabled={reveal.isPending}
								onClick={() => reveal.mutate()}
							>
								<Eye aria-hidden="true" className="size-3.5" />
								{t("home.wallet.balance")}
							</button>
						) : (
							<span />
						)}
						<span className="text-lg font-bold tabular-nums">
							{hidden ? MASK : shown === null ? (reveal.isError ? t("home.wallet.balanceFailed") : "—") : formatAmount(shown, i18n.language)}
							{shown !== null && !hidden ? <span className="ms-2 text-[11px] font-normal text-muted-foreground">{t("home.wallet.rial")}</span> : null}
						</span>
					</div>
				) : null}
			</div>
		</li>
	)
}

function AddTile({to, title, hint}: {to: string; title: string; hint: string}) {
	return (
		<li className="min-w-0">
			<Link
				to={to}
				className="flex h-full min-h-40 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-primary/60 bg-primary/5 p-4 text-center text-brand outline-offset-2 hover:bg-primary/10"
			>
				<span className="flex items-center gap-1 font-semibold">
					<Plus aria-hidden="true" className="size-4" />
					{title}
				</span>
				<span className="text-xs">{hint}</span>
			</Link>
		</li>
	)
}

/** How many tiles fit in a row at the current width: one on a phone, two from md, three from 2xl (the grid classes below). */
const useColumns = (): number => {
	const [columns, setColumns] = useState(1)
	useEffect(() => {
		const measure = () => setColumns(window.innerWidth >= 1536 ? 3 : window.innerWidth >= 768 ? 2 : 1)
		measure()
		window.addEventListener("resize", measure)
		return () => window.removeEventListener("resize", measure)
	}, [])
	return columns
}

/** Two rows of tiles that scroll sideways, with an arrow on each side; used once the tiles outgrow two rows. */
function TileSlider({children}: {children: ReactNode}) {
	const {t, i18n} = useTranslation()
	const track = useRef<HTMLUListElement>(null)
	const [canPrev, setCanPrev] = useState(false)
	const [canNext, setCanNext] = useState(false)
	const rtl = i18n.dir() === "rtl"

	const measure = () => {
		const el = track.current
		if (!el) return
		const offset = Math.abs(el.scrollLeft)
		setCanPrev(offset > 1)
		setCanNext(offset + el.clientWidth < el.scrollWidth - 1)
	}
	useEffect(measure)

	// In a right-to-left page "next" is towards the left, which scrolls by a negative amount.
	const slide = (direction: 1 | -1) => track.current?.scrollBy({left: direction * (rtl ? -1 : 1) * track.current.clientWidth, behavior: "smooth"})

	return (
		<div className="flex flex-col gap-3">
			<ul
				ref={track}
				onScroll={measure}
				className="grid snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden auto-cols-[100%] grid-flow-col grid-rows-2 gap-3 overflow-x-auto pb-1 md:auto-cols-[calc(50%-0.375rem)] 2xl:auto-cols-[calc(33.333%-0.5rem)] [&>li]:snap-start"
			>
				{children}
			</ul>
			{/* Fixed left-to-right so the arrow on the left always points left; which one means "next" depends on the page direction. */}
			<div dir="ltr" className="flex justify-center gap-2">
				<Button type="button" variant="outline" size="icon" className="size-9 rounded-xl" disabled={rtl ? !canNext : !canPrev} aria-label={t(rtl ? "button.next" : "button.previous")} onClick={() => slide(rtl ? 1 : -1)}>
					<ChevronLeft />
				</Button>
				<Button type="button" variant="outline" size="icon" className="size-9 rounded-xl" disabled={rtl ? !canPrev : !canNext} aria-label={t(rtl ? "button.previous" : "button.next")} onClick={() => slide(rtl ? -1 : 1)}>
					<ChevronRight />
				</Button>
			</div>
		</div>
	)
}

/** The user's accounts and cards as a grid of tiles, the first one highlighted, with a shortcut to add another. */
export function Wallet() {
	const {t, i18n} = useTranslation()
	const [tab, setTab] = useState<"accounts" | "cards">("accounts")
	const accounts = useQuery(accountsOptions(i18n.language))
	const cards = useQuery(cardsOptions(i18n.language))
	const active = tab === "accounts" ? accounts : cards
	const columns = useColumns()
	// The tiles plus the "add" tile: past two rows the grid becomes a slider.
	const count = (active.data?.length ?? 0) + 1
	const slides = count > columns * 2

	const tiles = (
		<>
		{tab === "accounts"
			? (accounts.data ?? []).map((account, index) => (
					<Tile
						key={account.id}
						kind="account"
						name={account.name || account.type}
						number={account.number}
						display={account.number}
						balance={account.balances.available}
						fetchBalance={account.canSeeBalance ? async () => (await getBalance(account.id)).available : undefined}
						featured={index === 0}
					/>
				))
			: (cards.data ?? []).map((card, index) => (
					<Tile
						key={card.id}
						kind="card"
						name={card.name || card.type}
						number={card.number}
						display={formatCardNumber(card.number)}
						balance={card.balances.available}
						fetchBalance={card.services.has("Balance") ? async () => (await getCardBalance(card.id)).available : undefined}
						featured={index === 0}
					/>
				))}
		{tab === "accounts" ? (
			<AddTile to={routeMap.accountNew.path} title={t("home.wallet.openAccount")} hint={t("home.wallet.openAccountHint")} />
		) : (
			<AddTile to={routeMap.cardList.path} title={t("home.wallet.allCards")} hint={t("home.wallet.allCardsHint")} />
		)}
		</>
	)

	return (
		<section aria-labelledby="wallet-title" className="flex h-full min-w-0 flex-col overflow-hidden rounded-[2rem] border bg-card shadow-card">
			<div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:px-6">
				<div>
					<h2 id="wallet-title" className="flex items-center gap-2 text-base font-semibold">
						<WalletCards aria-hidden="true" className="size-4 text-primary" />
						{t("home.wallet.title")}
					</h2>
					<p className="mt-1 text-xs text-muted-foreground">{t("home.wallet.subtitle")}</p>
				</div>
				<Tabs value={tab} onValueChange={(value) => setTab(value === "cards" ? "cards" : "accounts")}>
					<TabsList>
						<TabsTrigger value="accounts">{t("home.wallet.accounts")}</TabsTrigger>
						<TabsTrigger value="cards">{t("home.wallet.cards")}</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>
			<div className="flex-1 border-t p-5 sm:p-6">
				{active.isPending ? (
					<Skeleton className="h-40 w-full" />
				) : active.isError ? (
					<p role="alert" className="text-sm text-destructive">
						{t("home.wallet.error")}
					</p>
				) : slides ? (
					<TileSlider>{tiles}</TileSlider>
				) : (
					<ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{tiles}</ul>
				)}
			</div>
		</section>
	)
}
