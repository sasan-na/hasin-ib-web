import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"

import { routeMap } from "@/app/routes"
import {
	FieldError,
	FlowLayout,
	FlowSummary,
	StepSection,
} from "@/components/flow/flow-form"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
	getDocDestinations,
	requestToSendDocuments,
} from "@/features/branch/api/intra"
import {
	SignedPdfUpload,
	type SignedPdf,
} from "@/features/branch/components/signed-pdf-upload"
import { BranchSelect } from "@/features/transaction/components/branch-select"
import { ConfirmDialog } from "@/features/transaction/components/confirm-dialog"
import { useSubmitTransaction } from "@/features/transaction/hooks/use-submit-transaction"

/** Send a signed PDF to a branch, for a reason the bank lists. */
export default function BranchDocumentsPage() {
	const { t } = useTranslation()
	const reasons = useQuery({
		queryKey: ["branch", "doc-destinations"],
		queryFn: getDocDestinations,
		staleTime: 10 * 60_000,
		retry: false,
	})
	const [reason, setReason] = useState("")
	const [branchCode, setBranchCode] = useState("")
	const [document, setDocument] = useState<SignedPdf | null>(null)
	const [problem, setProblem] = useState("")
	const [confirming, setConfirming] = useState(false)

	const chosen = reasons.data?.find((item) => item.code === reason)

	const sending = useSubmitTransaction({
		run: () => {
			if (!chosen || !document) throw new Error("form incomplete")
			return requestToSendDocuments({
				reason: chosen.name,
				branchCode,
				document: document.base64,
			})
		},
		again: { to: routeMap.branch.path, label: t("branch.menu.back") },
		failedText: t("branch.documents.failed"),
		uncertainText: t("branch.documents.uncertain"),
	})

	const review = (): void => {
		if (!chosen) return setProblem(t("branch.documents.error.reason"))
		if (branchCode === "") return setProblem(t("branch.error.branch"))
		if (!document) return setProblem(t("branch.error.document"))
		setProblem("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("branch.documents.title")}</h1>
			<p className="text-muted-foreground text-sm">
				{t("branch.documents.hint")}
			</p>

			<FlowLayout
				aside={
					<FlowSummary
						id="bd-summary"
						title={t("branch.documents.summary")}
						amount={null}
						rows={[
							{
								label: t("branch.documents.reason"),
								value: chosen ? chosen.name : null,
							},
							{
								label: t("branch.branch"),
								value: branchCode !== "" ? branchCode : null,
							},
							{
								label: t("branch.upload.file"),
								value: document ? document.name : null,
							},
						]}
						reviewLabel={t("branch.review")}
						onReview={review}
					/>
				}
			>
				<StepSection
					id="bd-reason-step"
					step={1}
					title={t("branch.documents.reasonStep")}
				>
					<div className="flex flex-col gap-2">
						<Label htmlFor="bd-reason">{t("branch.documents.reason")}</Label>
						{reasons.isPending ? (
							<Skeleton className="h-9 w-full" />
						) : reasons.isError ? (
							<p role="alert" className="text-destructive text-sm">
								{t("branch.documents.loadError")}
							</p>
						) : (
							<Select
								value={reason}
								onValueChange={(next) => {
									setReason(next)
									setDocument(null)
								}}
							>
								<SelectTrigger id="bd-reason" className="w-full">
									<SelectValue
										placeholder={t("branch.documents.chooseReason")}
									/>
								</SelectTrigger>
								<SelectContent>
									{reasons.data.map((item) => (
										<SelectItem key={item.code} value={item.code}>
											{item.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="bd-branch">{t("branch.branch")}</Label>
						<BranchSelect
							id="bd-branch"
							value={branchCode}
							onChange={setBranchCode}
							invalid={problem !== "" && branchCode === ""}
						/>
					</div>
				</StepSection>

				<StepSection
					id="bd-document-step"
					step={2}
					title={t("branch.documents.documentStep")}
				>
					<SignedPdfUpload
						value={document}
						onChange={setDocument}
						accountNumber={null}
						templateHref="/files/IntraSendingDocSample.pdf"
						invalid={problem !== "" && !document}
					/>
					{problem ? <FieldError>{problem}</FieldError> : null}
					<div>
						<Button asChild variant="outline">
							<Link to={routeMap.branch.path}>{t("branch.menu.back")}</Link>
						</Button>
					</div>
				</StepSection>
			</FlowLayout>

			{confirming && chosen && document ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("branch.documents.confirmTitle")}
					description={t("branch.documents.confirmQuestion")}
					summary={[
						{ label: t("branch.documents.reason"), value: chosen.name },
						{
							label: t("branch.upload.file"),
							value: <span dir="ltr">{document.name}</span>,
						},
					]}
					confirmLabel={t("branch.send")}
					pendingLabel={t("branch.sending")}
					canConfirm={!sending.blocked}
					pending={sending.pending}
					error={sending.refusal}
					onConfirm={sending.submit}
				/>
			) : null}
		</div>
	)
}
