import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Alert, AlertDescription} from "@/components/ui/alert"
import {Button} from "@/components/ui/button"
import {deleteSavedCardInfo, saveCardInfo} from "@/features/card/api/card-actions"
import {cardCredentialInfoOptions, cardKeys} from "@/features/card/api/card.queries"
import {CardCredentialsFields, EMPTY_CREDENTIALS, isCredentialsComplete, toCredentials, type CredentialsForm} from "@/features/card/components/card-credentials"
import {ConfirmDialog} from "@/features/transaction/components/confirm-dialog"

/** The bank's service name for the SMS code on card requests. */
const CODE_SERVICE = "CardAuthorize"

interface SaveCardInfoSectionProps {
	cardId: number
	cardNumber: string
}

/**
 * Lets the user have the bank keep the card's CVV2 and expiry, so later card requests start pre-filled. The card
 * password and OTP are only used to prove it is the owner and are not kept.
 */
export function SaveCardInfoSection({cardId, cardNumber}: SaveCardInfoSectionProps) {
	const {t, i18n} = useTranslation()
	const queryClient = useQueryClient()
	const [form, setForm] = useState<CredentialsForm>(EMPTY_CREDENTIALS)
	const [deleting, setDeleting] = useState(false)
	const info = useQuery(cardCredentialInfoOptions(cardId, i18n.language))
	const credentials = toCredentials(cardNumber, form, info.data)
	const hasSaved = (info.data?.saved.cvv2 ?? "") !== ""

	const refresh = (): Promise<void> => queryClient.invalidateQueries({queryKey: cardKeys.credentials(cardId, i18n.language)})

	const save = useMutation({
		mutationFn: () => {
			if (!credentials) throw new Error("form incomplete")
			return saveCardInfo(cardId, credentials)
		},
		onSuccess: async () => {
			// What was typed does not outlive the request.
			setForm(EMPTY_CREDENTIALS)
			await refresh()
		},
	})

	const remove = useMutation({
		mutationFn: () => deleteSavedCardInfo(cardId),
		onSuccess: async () => {
			setDeleting(false)
			save.reset()
			await refresh()
		},
	})

	return (
		<section aria-labelledby="save-card-info" className="flex flex-col gap-4 border-t p-5">
			<h2 id="save-card-info" className="text-base font-semibold">
				{t("card.info.saveTitle")}
			</h2>
			<p className="text-sm text-muted-foreground">{t("card.info.saveNote")}</p>

			{hasSaved ? (
				<div className="flex flex-wrap items-center gap-3">
					<p role="status" className="text-sm font-medium text-success">
						{t("card.info.saved")}
					</p>
					<Button type="button" variant="outline" size="sm" onClick={() => setDeleting(true)}>
						{t("card.info.deleteSaved")}
					</Button>
				</div>
			) : null}

			{save.isSuccess ? (
				<Alert>
					<AlertDescription>{t("card.info.saveSuccess")}</AlertDescription>
				</Alert>
			) : null}
			{save.isError ? (
				<Alert variant="destructive">
					<AlertDescription>{save.error.message || t("card.info.saveError")}</AlertDescription>
				</Alert>
			) : null}
			{remove.isError ? (
				<Alert variant="destructive">
					<AlertDescription>{remove.error.message || t("card.info.deleteError")}</AlertDescription>
				</Alert>
			) : null}

			<CardCredentialsFields cardId={cardId} cardNumber={cardNumber} codeServiceName={CODE_SERVICE} value={form} onChange={setForm} disabled={save.isPending} />

			<div>
				<Button type="button" disabled={!isCredentialsComplete(form, info.data) || save.isPending} onClick={() => save.mutate()}>
					{save.isPending ? t("card.info.saving") : hasSaved ? t("card.info.update") : t("card.info.saveCard")}
				</Button>
			</div>

			{deleting ? (
				<ConfirmDialog
					open
					onOpenChange={(open) => (open ? undefined : setDeleting(false))}
					title={t("card.info.deleteTitle")}
					description={t("card.info.deleteQuestion")}
					summary={[]}
					confirmLabel={t("card.info.deleteSaved")}
					pendingLabel={t("card.info.deleting")}
					canConfirm
					pending={remove.isPending}
					error={remove.isError ? remove.error.message || t("card.info.deleteError") : null}
					onConfirm={() => remove.mutate()}
				/>
			) : null}
		</section>
	)
}
