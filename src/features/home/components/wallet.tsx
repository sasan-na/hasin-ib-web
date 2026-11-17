import {useMutation, useQuery} from "@tanstack/react-query"
import {Eye, Plus} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {CopyButton} from "@/components/copy-button"
import {Skeleton} from "@/components/ui/skeleton"
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs"
import {getBalance} from "@/features/account/api/account"
import {accountsOptions} from "@/features/account/api/account.queries"
import {getCardBalance} from "@/features/card/api/card"
import {cardsOptions} from "@/features/card/api/card.queries"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {cn} from "@/lib/utils"

interface TileProps {
	name: string
	number: string
	/** The number as shown; accounts keep it plain, cards in groups of four. */
	display: string
	/** What the list already carried. */
	balance: number | null
	/** Fetches a fresh balance; absent when the user may not see one. */
	fetchBalance?: () => Promise<number | null>
	tone: string
}

/** One account or card as a tile: its name, its number with copy, and its balance on request. */
function Tile({name, number, display, balance, fetchBalance, tone}: TileProps) {
	const {t, i18n} = useTranslation()
	const reveal = useMutation({mutationFn: async () => (fetchBalance ? fetchBalance() : null)})
	const shown = reveal.data ?? balance

	return (
		<li className={cn("flex w-72 shrink-0 snap-start flex-col justify-between gap-6 rounded-xl p-4 text-white", tone)}>
			<div className="flex flex-col gap-2">
				<h3 className="text-base font-semibold wrap-break-word">{name}</h3>
				<p dir="ltr" className="flex items-center justify-end gap-1 text-sm tabular-nums">
					{display}
					<CopyButton value={number} label={t("home.wallet.copy")} />
				</p>
			</div>
			{fetchBalance ? (
				<div className="flex items-center justify-between gap-2">
					<button
						type="button"
						className="flex items-center gap-1 text-sm underline-offset-4 hover:underline disabled:opacity-60"
						disabled={reveal.isPending}
						onClick={() => reveal.mutate()}
					>
						<Eye aria-hidden="true" className="size-4" />
						{t("home.wallet.balance")}
					</button>
					<span className="text-base font-bold tabular-nums">
						{shown === null ? (reveal.isError ? t("home.wallet.balanceFailed") : "—") : `${formatAmount(shown, i18n.language)} ${t("home.wallet.rial")}`}
					</span>
				</div>
			) : null}
		</li>
	)
}

function AddTile({to, title, hint}: {to: string; title: string; hint: string}) {
	return (
		<li className="w-72 shrink-0 snap-start">
			<Link
				to={to}
				className="flex h-full min-h-36 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/60 bg-primary/5 p-4 text-center text-primary outline-offset-2 hover:bg-primary/10"
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

const TONES = ["bg-primary", "bg-info", "bg-success", "bg-warning"]

/** The user's accounts and cards as a row of tiles that scrolls sideways, with a shortcut to add another. */
export function Wallet() {
	const {t, i18n} = useTranslation()
	const [tab, setTab] = useState<"accounts" | "cards">("accounts")
	const accounts = useQuery(accountsOptions(i18n.language))
	const cards = useQuery(cardsOptions(i18n.language))
	const active = tab === "accounts" ? accounts : cards

	return (
		<section aria-labelledby="wallet-title" className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-5">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="wallet-title" className="text-base font-semibold">
					{t("home.wallet.title")}
				</h2>
				<Tabs value={tab} onValueChange={(value) => setTab(value === "cards" ? "cards" : "accounts")}>
					<TabsList>
						<TabsTrigger value="accounts">{t("home.wallet.accounts")}</TabsTrigger>
						<TabsTrigger value="cards">{t("home.wallet.cards")}</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>
			{active.isPending ? (
				<Skeleton className="h-36 w-full" />
			) : active.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{t("home.wallet.error")}
				</p>
			) : (
				<ul className="flex snap-x gap-3 overflow-x-auto pb-2">
					{tab === "accounts"
						? (accounts.data ?? []).map((account, index) => (
								<Tile
									key={account.id}
									name={account.name || account.type}
									number={account.number}
									display={account.number}
									balance={account.balances.available}
									fetchBalance={account.canSeeBalance ? async () => (await getBalance(account.id)).available : undefined}
									tone={TONES[index % TONES.length]}
								/>
							))
						: (cards.data ?? []).map((card, index) => (
								<Tile
									key={card.id}
									name={card.name || card.type}
									number={card.number}
									display={formatCardNumber(card.number)}
									balance={card.balances.available}
									fetchBalance={card.services.has("Balance") ? async () => (await getCardBalance(card.id)).available : undefined}
									tone={TONES[index % TONES.length]}
								/>
							))}
					{tab === "accounts" ? (
						<AddTile to={routeMap.accountNew.path} title={t("home.wallet.openAccount")} hint={t("home.wallet.openAccountHint")} />
					) : (
						<AddTile to={routeMap.cardList.path} title={t("home.wallet.allCards")} hint={t("home.wallet.allCardsHint")} />
					)}
				</ul>
			)}
		</section>
	)
}
