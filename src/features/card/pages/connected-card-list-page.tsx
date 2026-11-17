import {useQuery} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {accountsOptions} from "@/features/account/api/account.queries"
import {getConnectedCardCredit, getConnectedCards, type ConnectedCard} from "@/features/card/api/connected-card"
import {ConnectDialog, CreditDialog, DisconnectDialog} from "@/features/card/components/connected-card-dialogs"
import {formatAmount, formatCardNumber} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

type Option = "all" | "active" | "closed"

/** The backup cards connected to an account: their credit, and putting credit on a card, taking it back or disconnecting it. */
export default function ConnectedCardListPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const accounts = useQuery(accountsOptions(language))
	const [accountId, setAccountId] = useState("")
	const [option, setOption] = useState<Option>("all")
	const [search, setSearch] = useState("")
	const [credits, setCredits] = useState<Record<string, {value?: number; error?: boolean; loading?: boolean}>>({})
	const [connecting, setConnecting] = useState(false)
	const [acting, setActing] = useState<{card: ConnectedCard; kind: "charge" | "discharge" | "disconnect"} | null>(null)

	const account = accounts.data?.find((candidate) => String(candidate.id) === accountId)
	const cards = useQuery({queryKey: ["card", "connected", account?.number ?? ""], queryFn: () => getConnectedCards(account?.number ?? ""), enabled: account !== undefined, staleTime: 60_000, retry: false})
	const money = (value: number): string => `${formatAmount(value, language)} ${t("card.connected.rial")}`

	const shown = (cards.data ?? []).filter((card) => (option === "all" || (option === "active" ? card.status === "N" : card.status === "C")) && (search === "" || card.number.includes(search)))

	const loadCredit = async (card: ConnectedCard): Promise<void> => {
		if (!account) return
		setCredits((current) => ({...current, [card.number]: {loading: true}}))
		try {
			const value = await getConnectedCardCredit(account.number, card.number)
			setCredits((current) => ({...current, [card.number]: {value}}))
		} catch {
			setCredits((current) => ({...current, [card.number]: {error: true}}))
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("card.connected.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("card.connected.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="cc-account">{t("card.connected.account")}</Label>
					{accounts.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : accounts.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("card.connected.accountsError")}
						</p>
					) : (
						<Select
							value={accountId}
							onValueChange={(value) => {
								setAccountId(value)
								setCredits({})
							}}
						>
							<SelectTrigger id="cc-account" className="w-full">
								<SelectValue placeholder={t("card.connected.chooseAccount")} />
							</SelectTrigger>
							<SelectContent>
								{accounts.data.map((candidate) => (
									<SelectItem key={candidate.id} value={String(candidate.id)}>
										<span>{candidate.name || candidate.type}</span> <span dir="ltr">{candidate.number}</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
				{account ? (
					<div className="flex flex-wrap items-end gap-3">
						<div className="flex gap-2" role="group" aria-label={t("card.connected.show")}>
							{(["all", "active", "closed"] as const).map((item) => (
								<Button key={item} type="button" size="sm" variant={option === item ? "default" : "outline"} aria-pressed={option === item} onClick={() => setOption(item)}>
									{t(`card.connected.option.${item}`)}
								</Button>
							))}
						</div>
						<Button type="button" size="sm" onClick={() => setConnecting(true)}>
							{t("card.connected.connect")}
						</Button>
						<Input className="max-w-52" dir="ltr" inputMode="numeric" autoComplete="off" placeholder={t("card.connected.searchCard")} aria-label={t("card.connected.searchCard")} value={search} onChange={(event) => setSearch(normalizeDigits(event.target.value).replace(/\D/g, ""))} />
					</div>
				) : null}
			</section>

			{account === undefined ? null : cards.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : cards.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{cards.error.message || t("card.connected.error")}
				</p>
			) : shown.length === 0 ? (
				<p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">{t("card.connected.empty")}</p>
			) : (
				<ul className="flex flex-col gap-3">
					{shown.map((card) => {
						const credit = credits[card.number]
						return (
							<li key={card.number} className="flex flex-col gap-3 rounded-lg border bg-card p-5">
								<div className="flex flex-wrap items-baseline justify-between gap-2">
									<h2 dir="ltr" className="text-base font-semibold tabular-nums">
										{formatCardNumber(card.number)}
									</h2>
									<span className="text-xs text-muted-foreground">{card.status === "N" ? t("card.connected.option.active") : card.status === "C" ? t("card.connected.option.closed") : card.status}</span>
								</div>
								<dl className="grid gap-1 text-sm sm:grid-cols-2">
									{card.expiryDate ? (
										<div className="flex gap-2">
											<dt className="text-muted-foreground">{t("card.connected.expiry")}:</dt>
											<dd dir="ltr">{card.expiryDate}</dd>
										</div>
									) : null}
									<div className="flex gap-2">
										<dt className="text-muted-foreground">{t("card.connected.credit")}:</dt>
										<dd>{credit?.loading ? t("card.connected.loading") : credit?.error ? t("card.connected.creditError") : money(credit?.value ?? card.credit)}</dd>
									</div>
								</dl>
								<div className="flex flex-wrap gap-2">
									<Button type="button" size="sm" variant="outline" disabled={credit?.loading} onClick={() => void loadCredit(card)}>
										{t("card.connected.refreshCredit")}
									</Button>
									{account ? (
										<Button asChild size="sm" variant="outline">
											<Link to={`${routeMap.cardConnectedStatement.path}?${new URLSearchParams({account: account.number, card: card.number}).toString()}`}>{t("card.connected.statement.open")}</Link>
										</Button>
									) : null}
									{card.status === "N" ? (
										<>
											<Button type="button" size="sm" onClick={() => setActing({card, kind: "charge"})}>
												{t("card.connected.charge")}
											</Button>
											<Button type="button" size="sm" variant="outline" onClick={() => setActing({card, kind: "discharge"})}>
												{t("card.connected.discharge")}
											</Button>
										</>
									) : null}
									<Button type="button" size="sm" variant="destructive" onClick={() => setActing({card, kind: "disconnect"})}>
										{t("card.connected.disconnect")}
									</Button>
								</div>
							</li>
						)
					})}
				</ul>
			)}

			{connecting && account ? <ConnectDialog payer={{id: account.id, number: account.number}} onClose={() => setConnecting(false)} /> : null}
			{acting && account ? (
				acting.kind === "disconnect" ? (
					<DisconnectDialog payer={{id: account.id, number: account.number}} card={acting.card} onClose={() => setActing(null)} />
				) : (
					<CreditDialog payer={{id: account.id, number: account.number}} card={acting.card} discharge={acting.kind === "discharge"} onClose={() => setActing(null)} />
				)
			) : null}
		</div>
	)
}
