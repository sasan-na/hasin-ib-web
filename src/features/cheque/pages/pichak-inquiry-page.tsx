import {useMutation} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {inquirePichak, type InquiryRole} from "@/features/cheque/api/pichak-inquiry"
import {PichakResult} from "@/features/cheque/components/pichak-result"
import {normalizeDigits} from "@/lib/normalize-digits"

const SAYYAD_LENGTH = 16

/** Look up a cheque in the central registry by its Sayyad id: as its drawer, or as someone holding it. */
export default function PichakInquiryPage() {
	const {t} = useTranslation()
	const [sayyadId, setSayyadId] = useState("")
	const [role, setRole] = useState<InquiryRole>("holder")
	const [ownerCheck, setOwnerCheck] = useState(false)

	const inquiry = useMutation({mutationFn: () => inquirePichak(sayyadId, role, role === "holder" && ownerCheck)})
	const valid = sayyadId.length === SAYYAD_LENGTH

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.pichak.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("cheque.pichak.intro")}</p>

			<form
				className="flex flex-col gap-4 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault()
					if (valid && !inquiry.isPending) inquiry.mutate()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="pi-sayyad">{t("cheque.sayyadId")}</Label>
					<Input
						id="pi-sayyad"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						maxLength={SAYYAD_LENGTH}
						value={sayyadId}
						aria-invalid={sayyadId !== "" && !valid}
						onChange={(event) => {
							setSayyadId(normalizeDigits(event.target.value).replace(/\D/g, ""))
							inquiry.reset()
						}}
					/>
					{sayyadId !== "" && !valid ? <p className="text-xs text-destructive">{t("cheque.pichak.sayyadLength", {count: SAYYAD_LENGTH})}</p> : null}
				</div>

				<div className="flex gap-2" role="group" aria-label={t("cheque.pichak.role")}>
					<Button type="button" size="sm" variant={role === "holder" ? "default" : "outline"} aria-pressed={role === "holder"} onClick={() => setRole("holder")}>
						{t("cheque.pichak.asHolder")}
					</Button>
					<Button type="button" size="sm" variant={role === "issuer" ? "default" : "outline"} aria-pressed={role === "issuer"} onClick={() => setRole("issuer")}>
						{t("cheque.pichak.asIssuer")}
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">{role === "holder" ? t("cheque.pichak.holderHint") : t("cheque.pichak.issuerHint")}</p>

				{role === "holder" ? (
					<div className="flex items-center gap-2">
						<Checkbox id="pi-owner" checked={ownerCheck} onCheckedChange={(on) => setOwnerCheck(on === true)} />
						<Label htmlFor="pi-owner" className="font-normal">
							{t("cheque.pichak.ownerCheck")}
						</Label>
					</div>
				) : null}

				<div>
					<Button type="submit" disabled={!valid || inquiry.isPending}>
						{inquiry.isPending ? t("cheque.pichak.inquiring") : t("cheque.pichak.inquire")}
					</Button>
				</div>
			</form>

			{inquiry.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{inquiry.error.message || t("cheque.pichak.failed")}
				</p>
			) : null}
			{inquiry.data ? (
				<section aria-label={t("cheque.pichak.result")} className="rounded-lg border bg-card p-5">
					<PichakResult inquiry={inquiry.data} />
				</section>
			) : null}
		</div>
	)
}
