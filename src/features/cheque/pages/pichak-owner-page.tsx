import {useMutation} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {inquireOwner} from "@/features/cheque/api/pichak-inquiry"
import {OwnerRecordView} from "@/features/cheque/components/pichak-result"
import {normalizeDigits} from "@/lib/normalize-digits"

const SAYYAD_LENGTH = 16

/** How much of a cheque drawer's money is tied up in cheques, and how their cheques have fared, from the registry. */
export default function PichakOwnerPage() {
	const {t} = useTranslation()
	const [sayyadId, setSayyadId] = useState("")
	const owner = useMutation({mutationFn: () => inquireOwner(sayyadId)})
	const valid = sayyadId.length === SAYYAD_LENGTH

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.owner.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("cheque.owner.intro")}</p>

			<form
				className="flex flex-col gap-4 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault()
					if (valid && !owner.isPending) owner.mutate()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="po-sayyad">{t("cheque.sayyadId")}</Label>
					<Input
						id="po-sayyad"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						maxLength={SAYYAD_LENGTH}
						value={sayyadId}
						aria-invalid={sayyadId !== "" && !valid}
						onChange={(event) => {
							setSayyadId(normalizeDigits(event.target.value).replace(/\D/g, ""))
							owner.reset()
						}}
					/>
					{sayyadId !== "" && !valid ? <p className="text-xs text-destructive">{t("cheque.pichak.sayyadLength", {count: SAYYAD_LENGTH})}</p> : null}
				</div>
				<div>
					<Button type="submit" disabled={!valid || owner.isPending}>
						{owner.isPending ? t("cheque.pichak.inquiring") : t("cheque.pichak.inquire")}
					</Button>
				</div>
			</form>

			{owner.isError ? (
				<p role="alert" className="rounded-lg border bg-card p-5 text-sm text-destructive">
					{owner.error.message || t("cheque.pichak.failed")}
				</p>
			) : null}
			{owner.data ? (
				<div className="rounded-lg border bg-card p-5">
					{owner.data.owners.length === 0 && owner.data.ongoing === "" && owner.data.blocked === "" ? (
						<p className="text-sm text-muted-foreground">{t("cheque.owner.empty")}</p>
					) : (
						<OwnerRecordView ongoing={owner.data.ongoing} blocked={owner.data.blocked} owners={owner.data.owners} />
					)}
				</div>
			) : null}
		</div>
	)
}
