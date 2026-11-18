import {useQuery} from "@tanstack/react-query"
import {Plus, Trash2} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Skeleton} from "@/components/ui/skeleton"
import {requestGiftCards, type GiftCardConfig} from "@/features/card/api/gift-card"
import {giftCardConfigOptions, replicaFormOptions} from "@/features/card/api/card.queries"
import {branchesOptions} from "@/features/transaction/api/branch.queries"
import type {SourceAccount} from "@/features/transaction/api/transaction"
import {AccountPassword, isPasswordComplete, usePasswordRequirement} from "@/features/transaction/components/account-password"
import {BranchSelect} from "@/features/transaction/components/branch-select"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {SourceAccountSelect} from "@/features/transaction/components/source-account-select"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

// The bank's names for this service: which accounts may pay, which no-password limit applies, and what it
// calls the SMS code.
const SOURCE_SERVICE = "RequestGiftCard"
const CODE_SERVICE = "NewGiftCard"
const MOBILE_PATTERN = /^09\d{9}$/

interface Line {
	key: number
	amount: string
	count: string
}

type LineErrors = Partial<Record<"amount" | "count", string>>
type Errors = {source?: string; branch?: string; mobile?: string; cards?: string; lines: Record<number, LineErrors>}

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "").replace(/^0+/, "")

/** Ask the bank to issue gift cards: how many of what amount, paid from one of your accounts, collected at a branch. */
export default function CardGiftPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	const config = useQuery(giftCardConfigOptions())
	const bank = useQuery(replicaFormOptions(language))
	const branches = useQuery(branchesOptions(language))

	const [source, setSource] = useState<SourceAccount | null>(null)
	const [branchCode, setBranchCode] = useState("")
	// Until the user types, the number the bank already has is offered.
	const [typedMobile, setTypedMobile] = useState<string | null>(null)
	const [lines, setLines] = useState<Line[]>([{key: 0, amount: "", count: ""}])
	const [errors, setErrors] = useState<Errors>({lines: {}})
	const [confirming, setConfirming] = useState(false)
	const [password, setPassword] = useState("")

	const mobile = typedMobile ?? bank.data?.mobile ?? ""
	const limits: GiftCardConfig | undefined = config.data
	const fee = limits?.fee ?? 0

	const filled = lines.filter((line) => line.amount !== "" && line.count !== "")
	const cardCount = filled.reduce((sum, line) => sum + Number(line.count), 0)
	const cardsTotal = filled.reduce((sum, line) => sum + Number(line.amount) * Number(line.count), 0)
	const feeTotal = cardCount * fee
	const grandTotal = cardsTotal + feeTotal
	const branchName = branches.data?.find((branch) => branch.code === branchCode)?.name ?? branchCode

	const requirement = usePasswordRequirement({accountId: confirming ? (source?.id ?? null) : null, limitServiceName: SOURCE_SERVICE, amount: grandTotal})

	const sending = useSubmitTransaction({
		run: () => {
			if (!source || requirement.state !== "ready") throw new Error("form incomplete")
			return requestGiftCards({
				sourceAccountNumber: source.number,
				sourcePassword: requirement.needsPassword ? password : null,
				sourcePasswordType: requirement.info.type,
				branchCode,
				mobile: mobile.trim(),
				lines: filled.map((line) => ({amount: Number(line.amount), count: Number(line.count)})),
				fee,
			})
		},
		again: {to: routeMap.cardGift.path, label: t("card.gift.again")},
		failedText: t("card.gift.failed"),
		uncertainText: t("card.gift.uncertain"),
	})

	const setLine = (key: number, patch: Partial<Line>): void => {
		setLines((current) => current.map((line) => (line.key === key ? {...line, ...patch} : line)))
		setErrors({lines: {}})
	}

	const addLine = (): void => setLines((current) => [...current, {key: Math.max(...current.map((line) => line.key)) + 1, amount: "", count: ""}])
	const removeLine = (key: number): void => setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current))

	const validate = (cfg: GiftCardConfig): Errors => {
		const found: Errors = {lines: {}}
		if (!source) found.source = t("card.gift.error.source")
		if (branchCode === "") found.branch = t("card.gift.error.branch")
		if (!MOBILE_PATTERN.test(mobile.trim())) found.mobile = t("card.gift.error.mobile")
		if (filled.length === 0) found.cards = t("card.gift.error.noCards")
		else if (cardCount > cfg.maxQuantity) found.cards = t("card.gift.error.maxCards", {count: formatAmount(cfg.maxQuantity, language)})
		for (const line of lines) {
			const problems: LineErrors = {}
			const hasAny = line.amount !== "" || line.count !== ""
			// A completely empty row is simply ignored; a half-filled one is a mistake.
			if (hasAny && line.amount === "") problems.amount = t("card.gift.error.amountRequired")
			else if (line.amount !== "") {
				const amount = Number(line.amount)
				if (amount < cfg.minAmount || amount > cfg.maxAmount) {
					problems.amount = t("card.gift.error.between", {min: formatAmount(cfg.minAmount, language), max: formatAmount(cfg.maxAmount, language)})
				} else if (amount % cfg.ratio !== 0) {
					problems.amount = t("card.gift.error.ratio", {value: formatAmount(cfg.ratio, language)})
				}
			}
			if (hasAny && line.count === "") problems.count = t("card.gift.error.countRequired")
			if (Object.keys(problems).length > 0) found.lines[line.key] = problems
		}
		return found
	}

	const review = (): void => {
		if (!limits) return
		const found = validate(limits)
		setErrors(found)
		if (found.source || found.branch || found.mobile || found.cards || Object.keys(found.lines).length > 0) return
		setPassword("")
		sending.reset()
		setConfirming(true)
	}

	const money = (value: number): string => `${formatAmount(value, language)} ${t("card.rial")}`

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("card.gift.title")}</h1>

			{config.isPending ? (
				<Skeleton className="h-24 w-full" />
			) : config.isError ? (
				<p role="alert" className="rounded-lg bg-card p-5 text-sm text-destructive">
					{t("card.gift.configError")}
				</p>
			) : (
				<dl className="grid gap-4 rounded-lg border bg-card p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
					<div className="flex flex-col">
						<dt className="text-muted-foreground">{t("card.gift.maxCards")}</dt>
						<dd className="font-semibold tabular-nums">{formatAmount(config.data.maxQuantity, language)}</dd>
					</div>
					<div className="flex flex-col">
						<dt className="text-muted-foreground">{t("card.gift.amountRange")}</dt>
						<dd className="font-semibold tabular-nums">
							{formatAmount(config.data.minAmount, language)} – {formatAmount(config.data.maxAmount, language)}
						</dd>
					</div>
					<div className="flex flex-col">
						<dt className="text-muted-foreground">{t("card.gift.ratio")}</dt>
						<dd className="font-semibold tabular-nums">{money(config.data.ratio)}</dd>
					</div>
					<div className="flex flex-col">
						<dt className="text-muted-foreground">{t("card.gift.fee")}</dt>
						<dd className="font-semibold tabular-nums">{money(config.data.fee)}</dd>
					</div>
				</dl>
			)}

			<section aria-labelledby="gift-account" className="flex flex-col gap-4 rounded-lg bg-card p-5">
				<h2 id="gift-account" className="text-base font-semibold">
					{t("card.gift.accountTitle")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="gift-source">{t("card.gift.account")}</Label>
					<SourceAccountSelect
						id="gift-source"
						serviceName={SOURCE_SERVICE}
						value={source?.id ?? null}
						onChange={(account) => {
							setSource(account)
							setErrors({lines: {}})
						}}
						invalid={errors.source !== undefined}
					/>
					{errors.source ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.source}
						</p>
					) : null}
				</div>
			</section>

			<section aria-labelledby="gift-cards" className="flex flex-col gap-4 rounded-lg bg-card p-5">
				<h2 id="gift-cards" className="text-base font-semibold">
					{t("card.gift.cardsTitle")}
				</h2>
				<div className="flex flex-col gap-2">
					<Label htmlFor="gift-branch">{t("card.gift.branch")}</Label>
					<BranchSelect
						id="gift-branch"
						value={branchCode}
						onChange={(code) => {
							setBranchCode(code)
							setErrors({lines: {}})
						}}
						invalid={errors.branch !== undefined}
					/>
					{errors.branch ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.branch}
						</p>
					) : null}
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="gift-mobile">{t("card.gift.mobile")}</Label>
					<Input
						id="gift-mobile"
						dir="ltr"
						inputMode="numeric"
						autoComplete="tel"
						maxLength={11}
						className="max-w-64"
						value={mobile}
						aria-invalid={errors.mobile !== undefined}
						onChange={(event) => {
							setTypedMobile(normalizeDigits(event.target.value).replace(/\D/g, ""))
							setErrors({lines: {}})
						}}
					/>
					{errors.mobile ? (
						<p role="alert" className="text-sm text-destructive">
							{errors.mobile}
						</p>
					) : null}
				</div>

				<ul className="flex flex-col gap-4">
					{lines.map((line, index) => {
						const problems = errors.lines[line.key]
						const lineTotal = line.amount !== "" && line.count !== "" ? Number(line.amount) * Number(line.count) : null
						return (
							<li key={line.key} className="flex flex-col gap-2 rounded-md border p-4">
								<div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-start">
									<div className="flex flex-col gap-2">
										<Label htmlFor={`gift-amount-${line.key}`}>{t("card.gift.cardAmount", {index: formatAmount(index + 1, language)})}</Label>
										<Input
											id={`gift-amount-${line.key}`}
											dir="ltr"
											inputMode="numeric"
											autoComplete="off"
											maxLength={String(limits?.maxAmount ?? 12).length}
											value={line.amount}
											aria-invalid={problems?.amount !== undefined}
											onChange={(event) => setLine(line.key, {amount: digits(event.target.value)})}
										/>
										{line.amount !== "" ? <p className="text-sm text-muted-foreground">{money(Number(line.amount))}</p> : null}
										{problems?.amount ? (
											<p role="alert" className="text-sm text-destructive">
												{problems.amount}
											</p>
										) : null}
									</div>
									<div className="flex flex-col gap-2">
										<Label htmlFor={`gift-count-${line.key}`}>{t("card.gift.count")}</Label>
										<Input
											id={`gift-count-${line.key}`}
											dir="ltr"
											inputMode="numeric"
											autoComplete="off"
											maxLength={String(limits?.maxQuantity ?? 4).length}
											value={line.count}
											aria-invalid={problems?.count !== undefined}
											onChange={(event) => setLine(line.key, {count: digits(event.target.value)})}
										/>
										{problems?.count ? (
											<p role="alert" className="text-sm text-destructive">
												{problems.count}
											</p>
										) : null}
									</div>
									<div className="flex items-start pt-7">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											disabled={lines.length === 1}
											aria-label={t("card.gift.removeLine", {index: formatAmount(index + 1, language)})}
											onClick={() => removeLine(line.key)}
										>
											<Trash2 aria-hidden="true" />
										</Button>
									</div>
								</div>
								{lineTotal !== null ? <p className="text-sm text-muted-foreground">{t("card.gift.lineTotal", {total: money(lineTotal)})}</p> : null}
							</li>
						)
					})}
				</ul>

				<div>
					<Button type="button" variant="outline" size="sm" onClick={addLine}>
						<Plus aria-hidden="true" />
						{t("card.gift.addLine")}
					</Button>
				</div>
				{errors.cards ? (
					<p role="alert" className="text-sm text-destructive">
						{errors.cards}
					</p>
				) : null}

				<dl className="flex flex-col gap-1 border-t pt-4 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("card.gift.cardCount")}</dt>
						<dd className="tabular-nums">{formatAmount(cardCount, language)}</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("card.gift.cardsTotal")}</dt>
						<dd className="tabular-nums">{money(cardsTotal)}</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("card.gift.feeTotal")}</dt>
						<dd className="tabular-nums">{money(feeTotal)}</dd>
					</div>
					<div className="flex justify-between gap-4 text-base font-semibold">
						<dt>{t("card.gift.grandTotal")}</dt>
						<dd className="tabular-nums">{money(grandTotal)}</dd>
					</div>
				</dl>
			</section>

			<div>
				<Button type="button" disabled={config.isPending || config.isError} onClick={review}>
					{t("card.gift.review")}
				</Button>
			</div>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (open) return
						// What was typed for the account does not outlive the dialog.
						setPassword("")
						setConfirming(false)
					}}
					title={t("card.gift.confirmTitle")}
					description={t("card.gift.confirmQuestion")}
					summary={[
						{label: t("card.gift.account"), value: <span dir="ltr">{source?.number}</span>},
						{label: t("card.gift.branch"), value: branchName},
						{label: t("card.gift.mobile"), value: <span dir="ltr">{mobile}</span>},
						{label: t("card.gift.cardCount"), value: formatAmount(cardCount, language)},
						{label: t("card.gift.cardsTotal"), value: money(cardsTotal)},
						{label: t("card.gift.feeTotal"), value: money(feeTotal)},
						{label: t("card.gift.grandTotal"), amount: true, value: money(grandTotal)},
					]}
					confirmLabel={t("card.gift.confirm")}
					pendingLabel={t("card.gift.sending")}
					canConfirm={isPasswordComplete(requirement, password) && !sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				>
					<table className="w-full text-sm">
						<thead>
							<tr className="text-muted-foreground">
								<th className="py-1 text-start font-normal">{t("card.gift.price")}</th>
								<th className="py-1 text-start font-normal">{t("card.gift.count")}</th>
								<th className="py-1 text-start font-normal">{t("card.gift.total")}</th>
							</tr>
						</thead>
						<tbody>
							{filled.map((line) => (
								<tr key={line.key} className="border-t tabular-nums">
									<td className="py-1">{formatAmount(Number(line.amount), language)}</td>
									<td className="py-1">{formatAmount(Number(line.count), language)}</td>
									<td className="py-1">{formatAmount(Number(line.amount) * Number(line.count), language)}</td>
								</tr>
							))}
						</tbody>
					</table>
					<AccountPassword
						requirement={requirement}
						accountNumber={source?.number ?? ""}
						codeServiceName={CODE_SERVICE}
						amount={grandTotal}
						value={password}
						onChange={setPassword}
						disabled={sending.pending}
					/>
				</ConfirmDialog>
			) : null}
		</div>
	)
}
