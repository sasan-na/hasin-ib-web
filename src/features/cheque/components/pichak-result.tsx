import {useTranslation} from "react-i18next"

import type {PichakInquiry, PichakPerson} from "@/features/cheque/api/pichak-inquiry"
import {formatAmount} from "@/lib/format"

/** A registry code shown as words when the code is known, and as it came when it is not. */
const useWords = () => {
	const {t} = useTranslation()
	return (group: "chequeType" | "media" | "status" | "guarantee" | "block" | "customerType", code: string): string => {
		if (code === "") return ""
		// A code the table does not know is shown as the registry sent it.
		return t(`cheque.pichak.${group}Codes.${code}`, {defaultValue: code})
	}
}

function Row({label, value, ltr = false}: {label: string; value: string; ltr?: boolean}) {
	if (value === "") return null
	return (
		<div className="flex flex-wrap justify-between gap-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd dir={ltr ? "ltr" : undefined} className="font-medium">
				{value}
			</dd>
		</div>
	)
}

function People({title, list}: {title: string; list: PichakPerson[]}) {
	const {t} = useTranslation()
	const words = useWords()
	if (list.length === 0) return null
	return (
		<section className="flex flex-col gap-2">
			<h3 className="text-sm font-semibold">{title}</h3>
			<ul className="flex flex-col gap-2">
				{list.map((person, index) => (
					<li key={index} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm">
						<span className="font-medium">{person.name}</span>
						<span className="text-muted-foreground">
							{words("customerType", person.idType) || t("cheque.pichak.unknownType")} · <span dir="ltr">{person.idCode}</span>
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}

/** What the cheque registry says about one cheque. */
export function PichakResult({inquiry}: {inquiry: PichakInquiry}) {
	const {t, i18n} = useTranslation()
	const words = useWords()
	const cheque = inquiry.cheque
	if (!cheque) return null
	const amount = cheque.amount !== "" && Number.isFinite(Number(cheque.amount)) ? `${formatAmount(Number(cheque.amount), i18n.language)} ${t("cheque.rial")}` : cheque.amount

	return (
		<div className="flex flex-col gap-5">
			<dl className="flex flex-col gap-2">
				<Row label={t("cheque.serial")} value={[cheque.series, cheque.serial].filter(Boolean).join(" / ")} ltr />
				<Row label={t("cheque.pichak.amount")} value={amount} />
				<Row label={t("cheque.pichak.dueDate")} value={cheque.dueDate} ltr />
				<Row label={t("cheque.pichak.issueDate")} value={cheque.issueDate} ltr />
				<Row label={t("cheque.pichak.iban")} value={cheque.iban} ltr />
				<Row label={t("cheque.pichak.bank")} value={cheque.bank} />
				<Row label={t("cheque.pichak.branch")} value={cheque.branch} />
				<Row label={t("cheque.pichak.description")} value={cheque.description} />
				<Row label={t("cheque.pichak.type")} value={words("chequeType", cheque.chequeType)} />
				<Row label={t("cheque.pichak.media")} value={words("media", cheque.media)} />
				<Row label={t("cheque.status")} value={words("status", cheque.status)} />
				<Row label={t("cheque.pichak.guarantee")} value={words("guarantee", cheque.guaranteeStatus)} />
				<Row label={t("cheque.pichak.block")} value={words("block", cheque.block)} />
				<Row label={t("cheque.pichak.reason")} value={cheque.reason} />
			</dl>
			<People title={t("cheque.pichak.receivers")} list={cheque.receivers} />
			<People title={t("cheque.pichak.signers")} list={cheque.signers} />
			{inquiry.owners.length > 0 || inquiry.ongoing !== "" || inquiry.blocked !== "" ? (
				<section className="flex flex-col gap-2">
					<h3 className="text-sm font-semibold">{t("cheque.pichak.ownerRecord")}</h3>
					<dl className="flex flex-col gap-2">
						<Row label={t("cheque.pichak.ongoing")} value={inquiry.ongoing} />
						<Row label={t("cheque.pichak.blockedCount")} value={inquiry.blocked} />
					</dl>
					<ul className="flex flex-col gap-2">
						{inquiry.owners.map((owner, index) => (
							<li key={index} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm">
								<span dir="ltr">{owner.idCode}</span>
								<span className="text-muted-foreground">{t("cheque.pichak.counts", {bounced: owner.bounced, cleared: owner.cleared})}</span>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	)
}
