import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import {
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	inquirePichak,
	inquireTransfer,
	TRANSFERABLE,
	WAITING_FOR_RECEIVER,
	type InquiryRole,
} from "@/features/cheque/api/pichak-inquiry"
import { PichakConfirmDialog } from "@/features/cheque/components/pichak-confirm-dialog"
import { PichakTransferSection } from "@/features/cheque/components/pichak-transfer-section"
import {
	PichakResult,
	TransferReceivers,
} from "@/features/cheque/components/pichak-result"
import { normalizeDigits } from "@/lib/normalize-digits"

const SAYYAD_LENGTH = 16

/** Look up a cheque in the central registry by its Sayyad id: as its drawer, or as someone holding it. */
export default function PichakInquiryPage() {
	const { t } = useTranslation()
	const [sayyadId, setSayyadId] = useState("")
	const [role, setRole] = useState<InquiryRole>("holder")
	const [ownerCheck, setOwnerCheck] = useState(false)

	const [answering, setAnswering] = useState<boolean | null>(null)
	const inquiry = useMutation({
		mutationFn: (asked: InquiryRole) =>
			inquirePichak(sayyadId, asked, asked === "holder" && ownerCheck),
	})
	// Only a holder who has just looked the cheque up can answer for it, and only while it waits for them.
	const canAnswer =
		inquiry.variables === "holder" &&
		inquiry.data?.cheque != null &&
		WAITING_FOR_RECEIVER.includes(inquiry.data.cheque.status)
	const canTransfer =
		inquiry.variables === "holder" &&
		inquiry.data?.cheque != null &&
		TRANSFERABLE.includes(inquiry.data.cheque.status)
	const transferStatus = useMutation({
		mutationFn: () => inquireTransfer(sayyadId),
	})
	const valid = sayyadId.length === SAYYAD_LENGTH

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.pichak.title")}</h1>
			<p className="text-muted-foreground text-sm">
				{t("cheque.pichak.intro")}
			</p>

			<form
				onSubmit={(event) => {
					event.preventDefault()
					if (valid && !inquiry.isPending) inquiry.mutate(role)
				}}
			>
				<FlowLayout
					aside={
						<FlowSummary
							id="pi-summary"
							title={t("cheque.pichak.summary")}
							amount={null}
							rows={[
								{ label: t("cheque.sayyadId"), value: valid ? sayyadId : null },
								{
									label: t("cheque.pichak.role"),
									value:
										role === "holder"
											? t("cheque.pichak.asHolder")
											: t("cheque.pichak.asIssuer"),
								},
							]}
							reviewLabel={
								inquiry.isPending
									? t("cheque.pichak.inquiring")
									: t("cheque.pichak.inquire")
							}
							onReview={() => {
								if (valid && !inquiry.isPending) inquiry.mutate(role)
							}}
						/>
					}
				>
					<StepSection
						id="pi-cheque-step"
						step={1}
						title={t("cheque.pichak.sayyadStep")}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="pi-sayyad">{t("cheque.sayyadId")}</Label>
							<Input
								id="pi-sayyad"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={SAYYAD_LENGTH}
								className="h-11 text-base"
								value={sayyadId}
								aria-invalid={sayyadId !== "" && !valid}
								aria-describedby={
									sayyadId !== "" && !valid ? "pi-sayyad-error" : undefined
								}
								onChange={(event) => {
									setSayyadId(
										normalizeDigits(event.target.value).replace(/\D/g, ""),
									)
									inquiry.reset()
									transferStatus.reset()
								}}
							/>
							{sayyadId !== "" && !valid ? (
								<FieldError id="pi-sayyad-error">
									{t("cheque.pichak.sayyadLength", { count: SAYYAD_LENGTH })}
								</FieldError>
							) : null}
						</div>
					</StepSection>

					<StepSection
						id="pi-role-step"
						step={2}
						title={t("cheque.pichak.roleStep")}
					>
						<div
							className="flex gap-2"
							role="group"
							aria-label={t("cheque.pichak.role")}
						>
							<Button
								type="button"
								variant={role === "holder" ? "default" : "outline"}
								aria-pressed={role === "holder"}
								onClick={() => setRole("holder")}
							>
								{t("cheque.pichak.asHolder")}
							</Button>
							<Button
								type="button"
								variant={role === "issuer" ? "default" : "outline"}
								aria-pressed={role === "issuer"}
								onClick={() => setRole("issuer")}
							>
								{t("cheque.pichak.asIssuer")}
							</Button>
						</div>
						<p className="text-muted-foreground text-xs">
							{role === "holder"
								? t("cheque.pichak.holderHint")
								: t("cheque.pichak.issuerHint")}
						</p>

						{role === "holder" ? (
							<div className="flex items-center gap-2">
								<Checkbox
									id="pi-owner"
									checked={ownerCheck}
									onCheckedChange={(on) => setOwnerCheck(on === true)}
								/>
								<Label htmlFor="pi-owner" className="font-normal">
									{t("cheque.pichak.ownerCheck")}
								</Label>
							</div>
						) : null}
					</StepSection>
				</FlowLayout>
			</form>

			{inquiry.isError ? (
				<p
					role="alert"
					className="bg-card shadow-card text-destructive rounded-2xl p-5 text-sm"
				>
					{inquiry.error.message || t("cheque.pichak.failed")}
				</p>
			) : null}
			{inquiry.data ? (
				<section
					aria-label={t("cheque.pichak.result")}
					className="bg-card shadow-card rounded-2xl p-5"
				>
					<PichakResult inquiry={inquiry.data} />
				</section>
			) : null}
			{canAnswer && inquiry.data?.cheque ? (
				<section
					aria-label={t("cheque.pichak.answer")}
					className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-5"
				>
					<p className="text-sm">{t("cheque.pichak.waiting")}</p>
					<div className="flex flex-wrap gap-2">
						<Button type="button" onClick={() => setAnswering(true)}>
							{t("cheque.pichak.accept")}
						</Button>
						<Button
							type="button"
							variant="outline"
							className="text-destructive"
							onClick={() => setAnswering(false)}
						>
							{t("cheque.pichak.reject")}
						</Button>
					</div>
				</section>
			) : null}
			{inquiry.variables === "holder" && inquiry.data?.cheque ? (
				<section
					aria-label={t("cheque.pichak.transferStatus")}
					className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-5"
				>
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-base font-semibold">
							{t("cheque.pichak.transferStatus")}
						</h2>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={transferStatus.isPending}
							onClick={() => transferStatus.mutate()}
						>
							{transferStatus.isPending
								? t("cheque.pichak.inquiring")
								: t("cheque.pichak.checkTransfer")}
						</Button>
					</div>
					{transferStatus.isError ? (
						<p role="alert" className="text-destructive text-sm">
							{transferStatus.error.message || t("cheque.pichak.failed")}
						</p>
					) : null}
					{transferStatus.data ? (
						<TransferReceivers
							receivers={transferStatus.data.transferReceivers}
						/>
					) : null}
				</section>
			) : null}
			{canTransfer && inquiry.data?.cheque ? (
				<PichakTransferSection
					key={sayyadId}
					sayyadId={sayyadId}
					cheque={inquiry.data.cheque}
				/>
			) : null}
			{answering !== null && inquiry.data?.cheque ? (
				<PichakConfirmDialog
					sayyadId={sayyadId}
					cheque={inquiry.data.cheque}
					accept={answering}
					onClose={() => setAnswering(null)}
				/>
			) : null}
		</div>
	)
}
