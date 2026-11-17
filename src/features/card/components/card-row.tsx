import {useMutation} from "@tanstack/react-query"
import {Ban, ChevronDown, ChevronUp, Info, Link2, RefreshCw, Repeat} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {CopyButton} from "@/components/copy-button"
import {CardBlockDialog} from "@/features/card/components/card-block-dialog"
import {getCardBalance, type Card, type CardBalances} from "@/features/card/api/card"
import {formatAmount, formatCardNumber} from "@/lib/format"

function Amount({label, value, language, large = false}: {label: string; value: number; language: string; large?: boolean}) {
	const {t} = useTranslation()
	return (
		<div className="flex flex-col md:items-end">
			<span className="text-sm text-muted-foreground">{label}</span>
			<span className={large ? "text-2xl font-extrabold tabular-nums" : "text-base font-medium tabular-nums"}>
				{formatAmount(value, language)} <span className="text-sm font-normal text-muted-foreground">{t("card.rial")}</span>
			</span>
		</div>
	)
}

/** Reordering within a category; absent while a filter is on, because a partial list cannot be reordered sensibly. */
export interface MoveControls {
	canMoveUp: boolean
	canMoveDown: boolean
	busy: boolean
	onMove: (direction: "up" | "down") => void
}

interface CardRowProps {
	card: Card
	/** The latest balances the user fetched in this visit; they win over what the list carried. */
	fresh?: CardBalances
	onFresh: (cardId: number, balances: CardBalances) => void
	move?: MoveControls
}

/** One card: who it is, its number (with copy), its default account, its balance on request, and where it sits in the list. */
export function CardRow({card, fresh, onFresh, move}: CardRowProps) {
	const {t, i18n} = useTranslation()
	const [blocking, setBlocking] = useState(false)
	const refresh = useMutation({
		mutationFn: () => getCardBalance(card.id),
		onSuccess: (balances) => onFresh(card.id, balances),
	})
	// A failed refresh leaves the older figures in place.
	const balances: CardBalances = fresh ?? card.balances
	const hasBalance = balances.available !== null || balances.total !== null
	const canSeeBalance = card.services.has("Balance")
	const name = card.name || card.type

	return (
		<li className="flex gap-3 px-5 py-4">
			{move ? (
				<div className="flex shrink-0 flex-col gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7"
						disabled={!move.canMoveUp || move.busy}
						aria-label={t("card.moveUp", {name})}
						onClick={() => move.onMove("up")}
					>
						<ChevronUp aria-hidden="true" className="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7"
						disabled={!move.canMoveDown || move.busy}
						aria-label={t("card.moveDown", {name})}
						onClick={() => move.onMove("down")}
					>
						<ChevronDown aria-hidden="true" className="size-4" />
					</Button>
				</div>
			) : null}
			<div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="flex min-w-0 flex-col gap-3">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h3 className="text-base font-semibold wrap-break-word">{name}</h3>
						{card.name && card.type ? <span className="text-sm text-muted-foreground">{card.type}</span> : null}
					</div>
					<dl className="flex flex-col gap-1 text-sm">
						<div className="flex flex-wrap items-center gap-x-2">
							<dt className="text-muted-foreground">{t("card.number")}</dt>
							<dd dir="ltr" className="flex items-center gap-1 tabular-nums">
								{formatCardNumber(card.number)}
								<CopyButton value={card.number} label={t("card.copyNumber")} />
							</dd>
						</div>
						{card.owner ? (
							<div className="flex flex-wrap items-center gap-x-2">
								<dt className="text-muted-foreground">{t("card.owner")}</dt>
								<dd>{card.owner}</dd>
							</div>
						) : null}
						{card.defaultAccountNumber ? (
							<div className="flex flex-wrap items-center gap-x-2">
								<dt className="text-muted-foreground">{t("card.defaultAccount")}</dt>
								<dd dir="ltr" className="tabular-nums">
									{card.defaultAccountNumber}
								</dd>
							</div>
						) : null}
					</dl>
				</div>

				<div className="flex flex-col gap-3 md:items-end">
					{canSeeBalance && hasBalance ? (
						<div className="flex flex-col gap-2">
							{balances.available !== null ? <Amount label={t("card.balance")} value={balances.available} language={i18n.language} large /> : null}
							{balances.total !== null ? <Amount label={t("card.totalBalance")} value={balances.total} language={i18n.language} /> : null}
							{balances.blocked !== null ? <Amount label={t("card.blockedAmount")} value={balances.blocked} language={i18n.language} /> : null}
						</div>
					) : null}
					{refresh.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("card.balanceError")}
						</p>
					) : null}
					<div className="flex flex-wrap gap-2">
						{canSeeBalance ? (
							<Button type="button" variant="outline" size="sm" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
								<RefreshCw aria-hidden="true" className={refresh.isPending ? "animate-spin" : undefined} />
								{refresh.isPending ? t("card.loadingBalance") : hasBalance ? t("card.refreshBalance") : t("card.showBalance")}
							</Button>
						) : null}
						{card.services.has("ConnectedAccounts") ? (
							<Button asChild variant="outline" size="sm">
								<Link to={`${routeMap.cardAccountList.path}?cardId=${card.id}`} aria-label={t("card.accountsFor", {name})}>
									<Link2 aria-hidden="true" />
									{t("card.accountsButton")}
								</Link>
							</Button>
						) : null}
						{card.services.has("Replica") ? (
							<Button asChild variant="outline" size="sm">
								<Link to={`${routeMap.cardReplicaRenew.path}?cardId=${card.id}`} aria-label={t("card.replicaFor", {name})}>
									<Repeat aria-hidden="true" />
									{t("card.replicaButton")}
								</Link>
							</Button>
						) : null}
						{card.services.has("Block") ? (
							<Button type="button" variant="outline" size="sm" className="text-destructive" aria-label={t("card.blockFor", {name})} onClick={() => setBlocking(true)}>
								<Ban aria-hidden="true" />
								{t("card.blockButton")}
							</Button>
						) : null}
						{card.services.has("Info") ? (
							<Button asChild variant="outline" size="sm">
								<Link to={`${routeMap.cardInfo.path}?cardId=${card.id}`} aria-label={t("card.infoFor", {name})}>
									<Info aria-hidden="true" />
									{t("card.infoButton")}
								</Link>
							</Button>
						) : null}
					</div>
				</div>
			</div>
			{blocking ? <CardBlockDialog cardNumber={card.number} cardName={name} onClose={() => setBlocking(false)} /> : null}
		</li>
	)
}
