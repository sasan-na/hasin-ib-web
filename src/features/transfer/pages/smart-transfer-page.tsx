import {useTranslation} from "react-i18next"
import {useSearchParams} from "react-router-dom"

import {AccountTransferForm} from "@/features/transfer/components/account-transfer-form"
import {CardTransferForm} from "@/features/transfer/components/card-transfer-form"
import {IbanTransferForm} from "@/features/transfer/components/iban-transfer-form"
import {TRANSFER_TYPES, TransferTypeTiles, type TransferType} from "@/features/transfer/components/transfer-type-tiles"

const parseType = (value: string | null): TransferType => TRANSFER_TYPES.find((type) => type === value) ?? "account"

/**
 * The one place to send money: choose account to account, card to card, Satna or Paya, and the form below is
 * rearranged for it (accounts or cards to pay from, an account, card or IBAN to pay to). The type lives in the
 * address (?type=card), so a link or a reload lands on the same form.
 */
export default function SmartTransferPage() {
	const {t} = useTranslation()
	const [params, setParams] = useSearchParams()
	const type = parseType(params.get("type"))

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
			<h1 className="text-2xl font-bold">{t("transfer.smart.title")}</h1>
			<TransferTypeTiles value={type} onChange={(next) => setParams(next === "account" ? {} : {type: next}, {replace: true})} />
			{/* A form is built for one kind of transfer, so a different kind starts a fresh form. */}
			{type === "card" ? <CardTransferForm key="card" /> : type === "satna" || type === "paya" ? <IbanTransferForm key={type} network={type} /> : <AccountTransferForm key="account" />}
		</div>
	)
}
