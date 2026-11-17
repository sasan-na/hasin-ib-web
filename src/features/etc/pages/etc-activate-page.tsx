import {useQuery, useQueryClient} from "@tanstack/react-query"
import {ArrowLeft, ArrowRight} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link, useSearchParams} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Skeleton} from "@/components/ui/skeleton"
import {activateEtc, getCarTypes} from "@/features/etc/api/etc"
import {etcKeys} from "@/features/etc/api/etc.queries"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {normalizeDigits} from "@/lib/normalize-digits"

const LETTERS = ["الف", "ب", "ت", "ج", "د", "ژ", "س", "ص", "ط", "ع", "ق", "ک", "ل", "م", "ن", "و", "ه", "ی"]
const digits = (value: string): string => normalizeDigits(value).replace(/\D/g, "")

/** Activate a toll tag for a car: its serial, the kind of car and the plate. */
export default function EtcActivatePage() {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [params] = useSearchParams()
	const types = useQuery({queryKey: ["etc", "car-types"], queryFn: getCarTypes, staleTime: 10 * 60_000, retry: false})
	const [serial, setSerial] = useState(() => digits(params.get("serial") ?? ""))
	const [carType, setCarType] = useState("")
	const [left, setLeft] = useState("")
	const [letter, setLetter] = useState("")
	const [middle, setMiddle] = useState("")
	const [right, setRight] = useState("")
	const [error, setError] = useState("")
	const [confirming, setConfirming] = useState(false)
	const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft
	const typeTitle = types.data?.find((type) => String(type.value) === carType)?.title ?? ""

	const sending = useSubmitTransaction({
		run: () => activateEtc({serial, carType: Number(carType), plate: {left, letter, middle, right}}),
		again: {to: routeMap.etcList.path, label: t("etc.again")},
		failedText: t("etc.failed"),
		uncertainText: t("etc.uncertain"),
		onDone: () => queryClient.invalidateQueries({queryKey: etcKeys.all}),
	})

	const review = (): void => {
		if (serial.length < 8) return setError(t("etc.charge.error.serial"))
		if (carType === "") return setError(t("etc.activate.error.carType"))
		if (left.length !== 2 || middle.length !== 3 || right.length !== 2 || letter === "" || Number(left) === 0 || Number(middle) === 0) return setError(t("etc.activate.error.plate"))
		setError("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold">{t("etc.activate.title")}</h1>
				<Button asChild variant="outline" size="sm">
					<Link to={routeMap.etcList.path}>
						<BackIcon aria-hidden="true" />
						{t("etc.again")}
					</Link>
				</Button>
			</div>
			<p className="text-sm text-muted-foreground">{t("etc.activate.hint")}</p>

			<section className="flex flex-col gap-4 rounded-lg border bg-card p-5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="act-serial">{t("etc.serial")}</Label>
					<Input id="act-serial" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={16} className="max-w-sm" value={serial} onChange={(event) => setSerial(digits(event.target.value))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="act-type">{t("etc.activate.carType")}</Label>
					{types.isPending ? (
						<Skeleton className="h-9 w-full" />
					) : types.isError ? (
						<p role="alert" className="text-sm text-destructive">
							{t("etc.activate.typesError")}
						</p>
					) : (
						<Select value={carType} onValueChange={setCarType}>
							<SelectTrigger id="act-type" className="w-full max-w-sm">
								<SelectValue placeholder={t("etc.activate.chooseType")} />
							</SelectTrigger>
							<SelectContent>
								{types.data.map((type) => (
									<SelectItem key={type.value} value={String(type.value)}>
										{type.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
				</div>
				<fieldset className="flex flex-col gap-2">
					<legend className="text-sm font-medium">{t("etc.plate")}</legend>
					<div dir="ltr" className="flex flex-wrap items-center gap-2">
						<Input aria-label={t("etc.activate.plateLeft")} inputMode="numeric" maxLength={2} className="w-16 text-center" value={left} onChange={(event) => setLeft(digits(event.target.value))} />
						<Select value={letter} onValueChange={setLetter}>
							<SelectTrigger aria-label={t("etc.activate.plateLetter")} className="w-24">
								<SelectValue placeholder="--" />
							</SelectTrigger>
							<SelectContent>
								{LETTERS.map((item) => (
									<SelectItem key={item} value={item}>
										{item}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Input aria-label={t("etc.activate.plateMiddle")} inputMode="numeric" maxLength={3} className="w-20 text-center" value={middle} onChange={(event) => setMiddle(digits(event.target.value))} />
						<span aria-hidden="true">-</span>
						<Input aria-label={t("etc.activate.plateRight")} inputMode="numeric" maxLength={2} className="w-16 text-center" value={right} onChange={(event) => setRight(digits(event.target.value))} />
					</div>
					<p className="text-xs text-muted-foreground">{t("etc.activate.plateHint")}</p>
				</fieldset>
				{error ? (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				) : null}
				<div>
					<Button type="button" onClick={review}>
						{t("etc.charge.review")}
					</Button>
				</div>
			</section>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("etc.activate.confirmTitle")}
					description={t("etc.activate.confirmQuestion")}
					summary={[
						{label: t("etc.serial"), value: <span dir="ltr">{serial}</span>},
						{label: t("etc.car"), value: typeTitle},
						{label: t("etc.plate"), value: <span dir="ltr">{`${left} ${letter} ${middle} - ${right}`}</span>},
					]}
					confirmLabel={t("etc.activate.confirm")}
					pendingLabel={t("etc.sending")}
					canConfirm={!sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				/>
			) : null}
		</div>
	)
}
