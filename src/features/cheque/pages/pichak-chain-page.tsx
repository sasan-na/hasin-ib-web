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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {
	getTransfersChain,
	type ChainChequeType,
} from "@/features/cheque/api/pichak-chain"
import { normalizeDigits } from "@/lib/normalize-digits"

const SAYYAD_LENGTH = 16
const TYPES: ChainChequeType[] = [1, 2, 3, 4]

/** The journey of a cheque through the registry: who wrote it, who got it, and everyone it was passed on to. */
export default function PichakChainPage() {
	const { t } = useTranslation()
	const [sayyadId, setSayyadId] = useState("")
	const [type, setType] = useState("")

	const chain = useMutation({
		mutationFn: () =>
			getTransfersChain(sayyadId, Number(type) as ChainChequeType),
	})
	const valid = sayyadId.length === SAYYAD_LENGTH && type !== ""

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.chain.title")}</h1>
			<p className="text-muted-foreground text-sm">{t("cheque.chain.intro")}</p>

			<form
				onSubmit={(event) => {
					event.preventDefault()
					if (valid && !chain.isPending) chain.mutate()
				}}
			>
				<FlowLayout
					aside={
						<FlowSummary
							id="pc-summary"
							title={t("cheque.chain.summary")}
							amount={null}
							rows={[
								{ label: t("cheque.sayyadId"), value: valid ? sayyadId : null },
								{
									label: t("cheque.pichak.type"),
									value:
										type !== ""
											? t(
													`cheque.chain.chequeTypes.${Number(type) as (typeof TYPES)[number]}`,
												)
											: null,
								},
							]}
							reviewLabel={
								chain.isPending
									? t("cheque.pichak.inquiring")
									: t("cheque.pichak.inquire")
							}
							onReview={() => {
								if (valid && !chain.isPending) chain.mutate()
							}}
						/>
					}
				>
					<StepSection
						id="pc-cheque-step"
						step={1}
						title={t("cheque.chain.sayyadStep")}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="pc-sayyad">{t("cheque.sayyadId")}</Label>
							<Input
								id="pc-sayyad"
								dir="ltr"
								inputMode="numeric"
								autoComplete="off"
								maxLength={SAYYAD_LENGTH}
								className="h-11 text-base"
								value={sayyadId}
								aria-invalid={
									sayyadId !== "" && sayyadId.length !== SAYYAD_LENGTH
								}
								aria-describedby={
									sayyadId !== "" && sayyadId.length !== SAYYAD_LENGTH
										? "pc-sayyad-error"
										: undefined
								}
								onChange={(event) => {
									setSayyadId(
										normalizeDigits(event.target.value).replace(/\D/g, ""),
									)
									chain.reset()
								}}
							/>
							{sayyadId !== "" && sayyadId.length !== SAYYAD_LENGTH ? (
								<FieldError id="pc-sayyad-error">
									{t("cheque.pichak.sayyadLength", { count: SAYYAD_LENGTH })}
								</FieldError>
							) : null}
						</div>
					</StepSection>

					<StepSection
						id="pc-type-step"
						step={2}
						title={t("cheque.chain.typeStep")}
					>
						<div className="flex flex-col gap-2">
							<Label htmlFor="pc-type">{t("cheque.pichak.type")}</Label>
							<Select
								value={type}
								onValueChange={(value) => {
									setType(value)
									chain.reset()
								}}
							>
								<SelectTrigger id="pc-type" className="h-11 w-full">
									<SelectValue placeholder={t("cheque.chain.chooseType")} />
								</SelectTrigger>
								<SelectContent>
									{TYPES.map((candidate) => (
										<SelectItem key={candidate} value={String(candidate)}>
											{t(`cheque.chain.chequeTypes.${candidate}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</StepSection>
				</FlowLayout>
			</form>

			{chain.isError ? (
				<p
					role="alert"
					className="bg-card shadow-card text-destructive rounded-2xl p-5 text-sm"
				>
					{chain.error.message || t("cheque.pichak.failed")}
				</p>
			) : null}

			{chain.data ? (
				chain.data.length === 0 ? (
					<p className="bg-card shadow-card text-muted-foreground rounded-2xl p-5 text-sm">
						{t("cheque.chain.empty")}
					</p>
				) : (
					<ol
						aria-label={t("cheque.chain.result")}
						className="flex flex-col gap-4"
					>
						{chain.data.map((step, index) => (
							<li
								key={index}
								className="bg-card shadow-card flex flex-col gap-3 rounded-2xl border p-5"
							>
								<h2 className="text-base font-semibold">
									{t(`cheque.chain.roles.${step.role}`, {
										defaultValue: step.roleText,
									})}
								</h2>
								<ul className="flex flex-col gap-2">
									{step.customers.map((customer, position) => (
										<li
											key={position}
											className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm"
										>
											<span className="font-medium">{customer.name}</span>
											<span className="text-muted-foreground">
												{t(
													`cheque.pichak.customerTypeCodes.${customer.idType}`,
													{ defaultValue: customer.idType },
												)}{" "}
												· <span dir="ltr">{customer.idCode}</span>
											</span>
										</li>
									))}
								</ul>
							</li>
						))}
					</ol>
				)
			) : null}
		</div>
	)
}
