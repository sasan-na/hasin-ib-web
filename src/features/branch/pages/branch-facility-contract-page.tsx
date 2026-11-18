import {useState} from "react"
import {useTranslation} from "react-i18next"
import {Link} from "react-router-dom"

import {routeMap} from "@/app/routes"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {requestFacilityContract} from "@/features/branch/api/intra"
import {BranchSelect} from "@/features/transaction/components/branch-select"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"
import {useSubmitTransaction} from "@/features/transaction/hooks/use-submit-transaction"
import {normalizeDigits} from "@/lib/normalize-digits"

/** Ask a branch for the contract of a facility (loan) you hold. */
export default function BranchFacilityContractPage() {
	const {t} = useTranslation()
	const [contractNumber, setContractNumber] = useState("")
	const [branchCode, setBranchCode] = useState("")
	const [problem, setProblem] = useState("")
	const [confirming, setConfirming] = useState(false)

	const sending = useSubmitTransaction({
		run: () => requestFacilityContract({contractNumber, branchCode}),
		again: {to: routeMap.branch.path, label: t("branch.menu.back")},
		failedText: t("branch.facility.failed"),
		uncertainText: t("branch.facility.uncertain"),
	})

	const review = (): void => {
		if (contractNumber.trim() === "") return setProblem(t("branch.facility.error.contract"))
		if (branchCode === "") return setProblem(t("branch.error.branch"))
		setProblem("")
		sending.reset()
		setConfirming(true)
	}

	return (
		<div className="mx-auto flex w-full max-w-xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("branch.facility.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("branch.facility.hint")}</p>

			<form
				className="flex flex-col gap-4 rounded-lg border bg-card p-5"
				onSubmit={(event) => {
					event.preventDefault()
					review()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bf-contract">{t("branch.facility.contract")}</Label>
					<Input id="bf-contract" dir="ltr" autoComplete="off" maxLength={30} className="max-w-72" value={contractNumber} onChange={(event) => setContractNumber(normalizeDigits(event.target.value).replace(/[^\dA-Za-z/-]/g, ""))} />
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="bf-branch">{t("branch.branch")}</Label>
					<BranchSelect id="bf-branch" value={branchCode} onChange={setBranchCode} invalid={problem !== "" && branchCode === ""} />
				</div>
				{problem ? (
					<p role="alert" className="text-sm text-destructive">
						{problem}
					</p>
				) : null}
				<div className="flex gap-2">
					<Button type="submit">{t("branch.review")}</Button>
					<Button asChild variant="outline">
						<Link to={routeMap.branch.path}>{t("branch.menu.back")}</Link>
					</Button>
				</div>
			</form>

			{confirming ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => {
						if (!open) setConfirming(false)
					}}
					title={t("branch.facility.confirmTitle")}
					description={t("branch.facility.confirmQuestion")}
					summary={[{label: t("branch.facility.contract"), value: <span dir="ltr">{contractNumber}</span>}]}
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
