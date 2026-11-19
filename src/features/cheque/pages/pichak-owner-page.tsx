import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { inquireOwner } from "@/features/cheque/api/pichak-inquiry"
import { OwnerRecordView } from "@/features/cheque/components/pichak-result"
import { normalizeDigits } from "@/lib/normalize-digits"

const SAYYAD_LENGTH = 16

/** How much of a cheque drawer's money is tied up in cheques, and how their cheques have fared, from the registry. */
export default function PichakOwnerPage() {
	const { t } = useTranslation()
	const [sayyadId, setSayyadId] = useState("")
	const owner = useMutation({ mutationFn: () => inquireOwner(sayyadId) })
	const valid = sayyadId.length === SAYYAD_LENGTH

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.owner.title")}</h1>
			<p className="text-muted-foreground text-sm">{t("cheque.owner.intro")}</p>

			<form
				onSubmit={(event) => {
					event.preventDefault()
					if (valid && !owner.isPending) owner.mutate()
				}}
			>
				<FlowLayout
					aside={
						<FlowSummary
							id="po-summary"
							title={t("cheque.owner.summary")}
							amount={null}
							rows={[
								{ label: t("cheque.sayyadId"), value: valid ? sayyadId : null },
							]}
							reviewLabel={
								owner.isPending
									? t("cheque.pichak.inquiring")
									: t("cheque.pichak.inquire")
							}
							onReview={() => {
								if (valid && !owner.isPending) owner.mutate()
							}}
						/>
					}
				>
					<StepSection
						id="po-cheque-step"
						step={1}
						title={t("cheque.owner.sayyadStep")}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="po-sayyad">{t("cheque.sayyadId")}</Label>
							<Input
								id="po-sayyad"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={SAYYAD_LENGTH}
								className="h-11 text-base"
								value={sayyadId}
								aria-invalid={sayyadId !== "" && !valid}
								aria-describedby={
									sayyadId !== "" && !valid ? "po-sayyad-error" : undefined
								}
								onChange={(event) => {
									setSayyadId(
										normalizeDigits(event.target.value).replace(/\D/g, ""),
									)
									owner.reset()
								}}
							/>
							{sayyadId !== "" && !valid ? (
								<FieldError id="po-sayyad-error">
									{t("cheque.pichak.sayyadLength", { count: SAYYAD_LENGTH })}
								</FieldError>
							) : null}
						</div>
					</StepSection>
				</FlowLayout>
			</form>

			{owner.isError ? (
				<p
					role="alert"
					className="bg-card shadow-card text-destructive rounded-2xl p-5 text-sm"
				>
					{owner.error.message || t("cheque.pichak.failed")}
				</p>
			) : null}
			{owner.data ? (
				<div className="bg-card shadow-card rounded-2xl border p-5">
					{owner.data.owners.length === 0 &&
					owner.data.ongoing === "" &&
					owner.data.blocked === "" ? (
						<p className="text-muted-foreground text-sm">
							{t("cheque.owner.empty")}
						</p>
					) : (
						<OwnerRecordView
							ongoing={owner.data.ongoing}
							blocked={owner.data.blocked}
							owners={owner.data.owners}
						/>
					)}
				</div>
			) : null}
		</div>
	)
}
