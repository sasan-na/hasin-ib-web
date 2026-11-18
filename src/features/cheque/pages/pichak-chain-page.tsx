import {useMutation} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {getTransfersChain, type ChainChequeType} from "@/features/cheque/api/pichak-chain"
import {normalizeDigits} from "@/lib/normalize-digits"

const SAYYAD_LENGTH = 16
const TYPES: ChainChequeType[] = [1, 2, 3, 4]

/** The journey of a cheque through the registry: who wrote it, who got it, and everyone it was passed on to. */
export default function PichakChainPage() {
	const {t} = useTranslation()
	const [sayyadId, setSayyadId] = useState("")
	const [type, setType] = useState("")

	const chain = useMutation({mutationFn: () => getTransfersChain(sayyadId, Number(type) as ChainChequeType)})
	const valid = sayyadId.length === SAYYAD_LENGTH && type !== ""

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("cheque.chain.title")}</h1>
			<p className="text-sm text-muted-foreground">{t("cheque.chain.intro")}</p>

			<form
				className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card"
				onSubmit={(event) => {
					event.preventDefault()
					if (valid && !chain.isPending) chain.mutate()
				}}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="pc-sayyad">{t("cheque.sayyadId")}</Label>
					<Input
						id="pc-sayyad"
						dir="ltr"
						inputMode="numeric"
						autoComplete="off"
						maxLength={SAYYAD_LENGTH}
						value={sayyadId}
						aria-invalid={sayyadId !== "" && sayyadId.length !== SAYYAD_LENGTH}
						aria-describedby={sayyadId !== "" && sayyadId.length !== SAYYAD_LENGTH ? "pc-sayyad-error" : undefined}
						onChange={(event) => {
							setSayyadId(normalizeDigits(event.target.value).replace(/\D/g, ""))
							chain.reset()
						}}
					/>
					{sayyadId !== "" && sayyadId.length !== SAYYAD_LENGTH ? <p id="pc-sayyad-error" role="alert" className="text-xs text-destructive">{t("cheque.pichak.sayyadLength", {count: SAYYAD_LENGTH})}</p> : null}
				</div>

				<div className="flex flex-col gap-2">
					<Label htmlFor="pc-type">{t("cheque.pichak.type")}</Label>
					<Select
						value={type}
						onValueChange={(value) => {
							setType(value)
							chain.reset()
						}}
					>
						<SelectTrigger id="pc-type" className="w-full">
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

				<div>
					<Button type="submit" disabled={!valid || chain.isPending}>
						{chain.isPending ? t("cheque.pichak.inquiring") : t("cheque.pichak.inquire")}
					</Button>
				</div>
			</form>

			{chain.isError ? (
				<p role="alert" className="rounded-2xl bg-card p-5 shadow-card text-sm text-destructive">
					{chain.error.message || t("cheque.pichak.failed")}
				</p>
			) : null}

			{chain.data ? (
				chain.data.length === 0 ? (
					<p className="rounded-2xl bg-card p-5 shadow-card text-sm text-muted-foreground">{t("cheque.chain.empty")}</p>
				) : (
					<ol aria-label={t("cheque.chain.result")} className="flex flex-col gap-4">
						{chain.data.map((step, index) => (
							<li key={index} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card">
								<h2 className="text-base font-semibold">{t(`cheque.chain.roles.${step.role}`, {defaultValue: step.roleText})}</h2>
								<ul className="flex flex-col gap-2">
									{step.customers.map((customer, position) => (
										<li key={position} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm">
											<span className="font-medium">{customer.name}</span>
											<span className="text-muted-foreground">
												{t(`cheque.pichak.customerTypeCodes.${customer.idType}`, {defaultValue: customer.idType})} · <span dir="ltr">{customer.idCode}</span>
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
