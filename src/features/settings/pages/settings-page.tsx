import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {addCountryLimitation, addIpLimitation, getCountries, getDisplayItems, getLimitations, removeLimitation, setDisplay, type DisplayItem, type DisplayKind, type Limitation} from "@/features/settings/api/settings"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {formatCardNumber} from "@/lib/format"

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/
const DISPLAY_KEY = ["settings", "display"] as const
const LIMIT_KEY = ["settings", "limitations"] as const

/** What the user chooses about their own bank: which accounts, cards and loans are shown, and where they may sign in from. */
export default function SettingsPage() {
	const {t} = useTranslation()
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("settings.title")}</h1>
			<DisplaySection />
			<LimitationsSection />
		</div>
	)
}

function DisplaySection() {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const items = useQuery({queryKey: DISPLAY_KEY, queryFn: getDisplayItems, staleTime: 60_000, retry: false})
	const [acting, setActing] = useState<DisplayItem | null>(null)
	const [refusal, setRefusal] = useState<string | null>(null)

	const change = useMutation({
		mutationFn: (item: DisplayItem) => setDisplay(item, !item.shown),
		onSuccess: () => {
			setActing(null)
			// Every list of accounts, cards and loans depends on what is shown.
			void queryClient.invalidateQueries()
		},
		onError: (error: Error) => setRefusal(error.message || t("settings.display.failed")),
	})

	const kinds: DisplayKind[] = ["account", "card", "loan"]

	return (
		<section className="flex flex-col gap-4 rounded-lg border bg-card p-5" aria-labelledby="st-display">
			<h2 id="st-display" className="text-base font-semibold">
				{t("settings.display.title")}
			</h2>
			<p className="text-sm text-muted-foreground">{t("settings.display.hint")}</p>
			{items.isPending ? (
				<Skeleton className="h-32 w-full" />
			) : items.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{items.error.message || t("settings.display.error")}
				</p>
			) : items.data.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t("settings.display.empty")}</p>
			) : (
				kinds.map((kind) => {
					const list = items.data.filter((item) => item.kind === kind)
					if (list.length === 0) return null
					return (
						<div key={kind} className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold">{t(`settings.display.kind.${kind}`)}</h3>
							<ul className="flex flex-col divide-y rounded-md border">
								{list.map((item) => (
									<li key={`${item.kind}-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 p-3">
										<div className="flex min-w-0 flex-col text-sm">
											<span className="font-medium">{item.name || item.typeName}</span>
											<span dir="ltr" className="text-start text-muted-foreground tabular-nums">
												{item.cardNumber && item.kind !== "account" ? formatCardNumber(item.cardNumber) : item.accountNumber}
											</span>
										</div>
										<Button
											type="button"
											size="sm"
											variant={item.shown ? "outline" : "default"}
											onClick={() => {
												setRefusal(null)
												setActing(item)
											}}
										>
											{item.shown ? t("settings.display.hide") : t("settings.display.show")}
										</Button>
									</li>
								))}
							</ul>
						</div>
					)
				})
			)}

			{acting ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setActing(null)
					}}
					title={acting.shown ? t("settings.display.hideTitle") : t("settings.display.showTitle")}
					description={acting.shown ? t("settings.display.hideQuestion") : t("settings.display.showQuestion")}
					summary={[
						{label: t(`settings.display.kind.${acting.kind}`), value: acting.name || acting.typeName},
						{label: t("settings.display.number"), value: <span dir="ltr">{acting.kind === "card" ? formatCardNumber(acting.cardNumber) : acting.accountNumber}</span>},
					]}
					confirmLabel={acting.shown ? t("settings.display.hide") : t("settings.display.show")}
					pendingLabel={t("settings.saving")}
					canConfirm
					pending={change.isPending}
					error={refusal}
					onConfirm={() => {
						setRefusal(null)
						change.mutate(acting)
					}}
				/>
			) : null}
		</section>
	)
}

function LimitationsSection() {
	const {t} = useTranslation()
	const queryClient = useQueryClient()
	const limits = useQuery({queryKey: LIMIT_KEY, queryFn: getLimitations, staleTime: 60_000, retry: false})
	const countries = useQuery({queryKey: ["settings", "countries"], queryFn: getCountries, staleTime: 10 * 60_000, retry: false})
	const [country, setCountry] = useState("")
	const [fromIp, setFromIp] = useState("")
	const [toIp, setToIp] = useState("")
	const [problem, setProblem] = useState("")
	const [pending, setPending] = useState<{kind: "country" | "range" | "remove"; limitation?: Limitation} | null>(null)
	const [refusal, setRefusal] = useState<string | null>(null)

	const run = useMutation({
		mutationFn: async (action: NonNullable<typeof pending>) => {
			if (action.kind === "country") await addCountryLimitation(country)
			else if (action.kind === "range") await addIpLimitation(fromIp.trim(), toIp.trim())
			else if (action.limitation) await removeLimitation(action.limitation)
		},
		onSuccess: () => {
			setPending(null)
			setCountry("")
			setFromIp("")
			setToIp("")
			void queryClient.invalidateQueries({queryKey: LIMIT_KEY})
		},
		onError: (error: Error) => setRefusal(error.message || t("settings.limits.failed")),
	})

	const used = new Set((limits.data ?? []).filter((limit) => limit.kind === 0).map((limit) => limit.countryCode))
	const countryName = countries.data?.find((item) => item.code === country)?.name ?? country

	const reviewRange = (): void => {
		if (!IPV4.test(fromIp.trim()) || !IPV4.test(toIp.trim())) return setProblem(t("settings.limits.errorIp"))
		setProblem("")
		setRefusal(null)
		setPending({kind: "range"})
	}

	return (
		<section className="flex flex-col gap-4 rounded-lg border bg-card p-5" aria-labelledby="st-limits">
			<h2 id="st-limits" className="text-base font-semibold">
				{t("settings.limits.title")}
			</h2>
			<Alert>
				<AlertDescription>{t("settings.limits.warning")}</AlertDescription>
			</Alert>

			{limits.isPending ? (
				<Skeleton className="h-20 w-full" />
			) : limits.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{limits.error.message || t("settings.limits.error")}
				</p>
			) : limits.data.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t("settings.limits.none")}</p>
			) : (
				<ul className="flex flex-col divide-y rounded-md border">
					{limits.data.map((limit, index) => (
						<li key={index} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
							<span>
								<span className="font-medium">{limit.typeName}</span> <span dir="ltr">{limit.details}</span>
							</span>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => {
									setRefusal(null)
									setPending({kind: "remove", limitation: limit})
								}}
							>
								{t("settings.limits.remove")}
							</Button>
						</li>
					))}
				</ul>
			)}

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label htmlFor="st-country">{t("settings.limits.country")}</Label>
					<div className="flex gap-2">
						<Select value={country} onValueChange={setCountry}>
							<SelectTrigger id="st-country" className="w-full">
								<SelectValue placeholder={t("settings.limits.chooseCountry")} />
							</SelectTrigger>
							<SelectContent>
								{(countries.data ?? []).filter((item) => !used.has(item.code)).map((item) => (
									<SelectItem key={item.code} value={item.code}>
										{item.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							type="button"
							variant="outline"
							disabled={country === ""}
							onClick={() => {
								setRefusal(null)
								setPending({kind: "country"})
							}}
						>
							{t("settings.limits.add")}
						</Button>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="st-from">{t("settings.limits.range")}</Label>
					<div className="flex flex-wrap items-center gap-2">
						<Input id="st-from" dir="ltr" autoComplete="off" placeholder="192.168.0.1" className="w-40" value={fromIp} onChange={(event) => setFromIp(event.target.value)} />
						<Input aria-label={t("settings.limits.to")} dir="ltr" autoComplete="off" placeholder="192.168.0.254" className="w-40" value={toIp} onChange={(event) => setToIp(event.target.value)} />
						<Button type="button" variant="outline" disabled={fromIp === "" || toIp === ""} onClick={reviewRange}>
							{t("settings.limits.add")}
						</Button>
					</div>
					{problem ? (
						<p role="alert" className="text-sm text-destructive">
							{problem}
						</p>
					) : null}
				</div>
			</div>

			{pending ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setPending(null)
					}}
					title={pending.kind === "remove" ? t("settings.limits.removeTitle") : t("settings.limits.addTitle")}
					description={pending.kind === "remove" ? t("settings.limits.removeQuestion") : t("settings.limits.addQuestion")}
					summary={
						pending.kind === "remove" && pending.limitation
							? [{label: pending.limitation.typeName, value: <span dir="ltr">{pending.limitation.details}</span>}]
							: pending.kind === "country"
								? [{label: t("settings.limits.country"), value: countryName}]
								: [{label: t("settings.limits.range"), value: <span dir="ltr">{`${fromIp.trim()} – ${toIp.trim()}`}</span>}]
					}
					confirmLabel={pending.kind === "remove" ? t("settings.limits.remove") : t("settings.limits.add")}
					pendingLabel={t("settings.saving")}
					destructive={pending.kind !== "remove"}
					canConfirm
					pending={run.isPending}
					error={refusal}
					onConfirm={() => {
						setRefusal(null)
						run.mutate(pending)
					}}
				/>
			) : null}
		</section>
	)
}
