import {useMutation} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import {clearCheque, getHeldCheque, lockForCashing, unlockForCashing, type HeldCheque} from "@/features/cheque/api/chakad-cashing"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {isValidIban} from "@/features/transfer/lib/numbers"
import {formatAmount} from "@/lib/format"
import {normalizeDigits} from "@/lib/normalize-digits"

type Mode = "lock" | "unlock" | "clear"
const MODES: Mode[] = ["lock", "unlock", "clear"]
const SAYYAD_LENGTH = 16

const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")
/** "14050101" as "1405/01/01"; anything else as it came. */
const dueText = (value: string): string => (/^\d{8}$/.test(value) ? `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6)}` : value)

/** What the holder of a digital cheque does to get paid: lock it for cashing, remove the lock, or cash it inside the bank. */
export default function ChakadCashingPage() {
	const {t, i18n} = useTranslation()
	const language = i18n.language
	// The cartable opens this page with a cheque and what to do already chosen.
	const [params] = useSearchParams()
	const wanted = params.get("mode")
	const [mode, setMode] = useState<Mode>(MODES.find((item) => item === wanted) ?? "lock")
	const [sayyadId, setSayyadId] = useState((params.get("sayyad") ?? "").replace(/\D/g, "").slice(0, SAYYAD_LENGTH))
	const [cheque, setCheque] = useState<HeldCheque | null>(null)
	const [problem, setProblem] = useState("")
	const [bounced, setBounced] = useState<"1" | "0" | "">("")
	const [iban, setIban] = useState("")
	const [description, setDescription] = useState("")
	const [confirming, setConfirming] = useState(false)

	const money = (value: number): string => `${formatAmount(value, language)} ${t("cheque.rial")}`

	const lookUp = useMutation({
		mutationFn: () => getHeldCheque(sayyadId),
		onSuccess: (found) => {
			setProblem("")
			setCheque(found)
		},
		onError: (error: Error) => {
			setCheque(null)
			setProblem(error.message || t("cheque.guarantee.lookupFailed"))
		},
	})

	const sending = useSubmitTransaction({
		run: () => {
			if (!cheque) throw new Error("no cheque")
			if (mode === "lock") return lockForCashing(cheque, bounced === "1", iban)
			if (mode === "unlock") return unlockForCashing(cheque)
			return clearCheque(cheque, iban, description.trim())
		},
		again: {to: routeMap.chequeList.path, label: t("cheque.block.backToList")},
		failedText: t("cheque.cashing.failed"),
		uncertainText: t("cheque.cashing.uncertain"),
	})

	const reset = (next: Mode): void => {
		setMode(next)
		setProblem("")
		setBounced("")
		setIban("")
		setDescription("")
	}

	const review = (): void => {
		if (!cheque) return
		if (mode === "lock" && cheque.locked) return setProblem(t("cheque.cashing.error.alreadyLocked"))
		if (mode === "unlock" && !cheque.locked) return setProblem(t("cheque.cashing.error.notLocked"))
		if (mode === "lock" && bounced === "") return setProblem(t("cheque.cashing.error.bounce"))
		if (mode === "clear" && !isValidIban(iban)) return setProblem(t("cheque.cashing.error.iban"))
		if (mode === "lock" && iban !== "" && !isValidIban(iban)) return setProblem(t("cheque.cashing.error.iban"))
		setProblem("")
		sending.reset()
		setConfirming(true)
	}

	const row = (label: string, value: string, ltr = false) =>
		value === "" ? null : (
			<div key={label} className="flex flex-col">
				<dt className="text-muted-foreground">{label}</dt>
				<dd dir={ltr ? "ltr" : undefined} className="font-medium wrap-break-word">
					{value}
				</dd>
			</div>
		)

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.cashing.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("cheque.cashing.hint")}</p>

			<div className="flex flex-wrap gap-2" role="tablist" aria-label={t("cheque.cashing.title")}>
				{MODES.map((item) => (
					<Button key={item} type="button" role="tab" aria-selected={mode === item} variant={mode === item ? "default" : "outline"} size="sm" onClick={() => reset(item)}>
						{t(`cheque.cashing.modes.${item}`)}
					</Button>
				))}
			</div>
			<p className="text-sm text-muted-foreground">{t(`cheque.cashing.modeHint.${mode}`)}</p>

			<form
				className="flex flex-col gap-4 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault()
					if (sayyadId.length !== SAYYAD_LENGTH) return setProblem(t("cheque.guarantee.error.sayyad", {length: SAYYAD_LENGTH}))
					setProblem("")
					setCheque(null)
					lookUp.mutate()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="cc-sayyad">{t("cheque.sayyadId")}</Label>
					<Input id="cc-sayyad" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={SAYYAD_LENGTH} className="max-w-72" value={sayyadId} onChange={(event) => setSayyadId(digits(event.target.value))} />
				</div>
				<div>
					<Button type="submit" disabled={lookUp.isPending}>
						{lookUp.isPending ? t("cheque.guarantee.looking") : t("cheque.guarantee.lookUp")}
					</Button>
				</div>
			</form>

			{problem ? (
				<Alert variant="destructive">
					<AlertDescription>{problem}</AlertDescription>
				</Alert>
			) : null}

			{cheque ? (
				<section className="flex flex-col gap-4">
					<dl className="grid gap-2 rounded-lg border bg-card p-5 text-sm sm:grid-cols-2">
						{row(t("cheque.sayyadId"), cheque.sayyadId, true)}
						{row(t("cheque.serial"), `${cheque.series} / ${cheque.serial}`, true)}
						{row(t("cheque.register.dueDate"), dueText(cheque.dueDate), true)}
						{row(t("cheque.pichak.amount"), money(cheque.amount))}
						{row(t("cheque.guarantee.status"), cheque.status)}
						{row(t("cheque.guarantee.blocked"), cheque.blocked)}
						{row(t("cheque.guarantee.locked"), cheque.lockText)}
						{row(t("cheque.pichak.description"), cheque.description)}
					</dl>

					{mode === "lock" ? (
						<fieldset className="flex flex-col gap-2 rounded-lg border bg-card p-5">
							<legend className="px-1 text-sm font-medium">{t("cheque.cashing.bounceQuestion")}</legend>
							{(["1", "0"] as const).map((value) => (
								<label key={value} className="flex items-center gap-2 text-sm">
									<input type="radio" name="cc-bounce" className="accent-primary" checked={bounced === value} onChange={() => setBounced(value)} />
									{value === "1" ? t("cheque.cashing.bounced") : t("cheque.cashing.notBounced")}
								</label>
							))}
						</fieldset>
					) : null}

					{mode === "lock" || mode === "clear" ? (
						<div className="flex flex-col gap-2 rounded-lg border bg-card p-5">
							<Label htmlFor="cc-iban">
								{t("cheque.cashing.iban")} {mode === "lock" ? <span className="font-normal text-muted-foreground">({t("cheque.register.optional")})</span> : null}
							</Label>
							<div className="flex items-center gap-1" dir="ltr">
								<span className="text-sm text-muted-foreground">IR</span>
								<Input id="cc-iban" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={24} value={iban} onChange={(event) => setIban(digits(event.target.value))} />
							</div>
							{mode === "clear" ? (
								<>
									<Label htmlFor="cc-description">
										{t("cheque.pichak.description")} <span className="font-normal text-muted-foreground">({t("cheque.register.optional")})</span>
									</Label>
									<Textarea id="cc-description" rows={2} maxLength={250} value={description} onChange={(event) => setDescription(event.target.value)} />
								</>
							) : null}
						</div>
					) : null}

					<div className="flex gap-2">
						<Button type="button" onClick={review}>
							{t("cheque.register.review")}
						</Button>
						<Button asChild variant="outline">
							<Link to={routeMap.chakadCartable.path}>{t("cheque.cartable.title")}</Link>
						</Button>
					</div>
				</section>
			) : null}

			{confirming && cheque ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t(`cheque.cashing.confirm.${mode}.title`)}
					description={t(`cheque.cashing.confirm.${mode}.question`)}
					summary={[
						{label: t("cheque.sayyadId"), value: <span dir="ltr">{cheque.sayyadId}</span>},
						{label: t("cheque.pichak.amount"), value: <strong>{money(cheque.amount)}</strong>},
						...(iban !== "" ? [{label: t("cheque.cashing.iban"), value: <span dir="ltr">{`IR${iban}`}</span>}] : []),
					]}
					confirmLabel={t(`cheque.cashing.confirm.${mode}.button`)}
					pendingLabel={t("cheque.guarantee.sending")}
					destructive={mode === "clear"}
					canConfirm={!sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				/>
			) : null}
		</div>
	)
}
