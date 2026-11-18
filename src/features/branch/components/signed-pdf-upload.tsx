import {useMutation, useQuery} from "@tanstack/react-query"
import {FileText, KeyRound} from "lucide-react"
import {useRef, useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {checkDocument, getMaxDocumentKb} from "@/features/branch/api/intra"
import {drawStamp, finishSignature, requestDigest} from "@/features/branch/api/pdf-sign"
import {DASTINE_ERROR_CODES, DastineError, loadDastine, selectCertificate, signDigest} from "@/features/branch/lib/dastine"
import {getMyNationalCode} from "@/features/profile/api/profile"
import {formatJalali} from "@/lib/jalali"

export interface SignedPdf {
	name: string
	/** The file as base64, without the "data:" prefix. */
	base64: string
	/** The document was signed here, with the customer's token. */
	signed?: boolean
}

interface Props {
	value: SignedPdf | null
	onChange: (value: SignedPdf | null) => void
	/** The account the document is for (a transfer), or null when it is not tied to one. */
	accountNumber: string | null
	/** Links to the form to fill in before signing, when there is one. */
	templateHref?: string
	invalid?: boolean
}

const readAsBase64 = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""))
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(file)
	})

/** Where to download the signing service for the customer's computer; the link is hidden while this is unset. */
const SIGN_APP_URL: string | undefined = import.meta.env.VITE_SIGN_APP_DOWNLOAD_URL

const pad = (value: number): string => String(value).padStart(2, "0")

/**
 * Takes a PDF for the bank: either one already signed with the customer's digital certificate, or one to sign here with the
 * certificate on their token (through the signing service installed on their computer). The bank checks the result either way.
 */
export function SignedPdfUpload({value, onChange, accountNumber, templateHref, invalid = false}: Props) {
	const {t} = useTranslation()
	const input = useRef<HTMLInputElement>(null)
	const maxKb = useQuery({queryKey: ["branch", "max-document"], queryFn: getMaxDocumentKb, staleTime: 10 * 60_000, retry: false})
	const check = useMutation({mutationFn: (document: string) => checkDocument(document, accountNumber)})
	const [fileProblem, setFileProblem] = useState<string | null>(null)
	const [signProblem, setSignProblem] = useState<{text: string; missing: boolean} | null>(null)

	const sign = useMutation({
		mutationFn: async (pdf: SignedPdf): Promise<SignedPdf> => {
			const dastine = await loadDastine()
			const certificate = await selectCertificate(dastine)
			const nationalCode = await getMyNationalCode()
			const now = new Date()
			const when = `${formatJalali(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
			const request = {
				signerCertificate: certificate,
				pdfData: pdf.base64,
				dateTime: now.toISOString(),
				imageDataUrl: drawStamp(t("branch.sign.stamp", {nationalCode, date: when})),
				signatureFieldName: `Sign${Date.now()}`,
				nationalCode,
			}
			const digest = await requestDigest(request)
			const signature = await signDigest(dastine, digest)
			return {name: pdf.name.startsWith("signed-") ? pdf.name : `signed-${pdf.name}`, base64: await finishSignature(request, digest, signature), signed: true}
		},
		onSuccess: (signed) => {
			setSignProblem(null)
			check.reset()
			onChange(signed)
		},
		onError: (error: Error) => {
			if (error instanceof DastineError) {
				const known = (DASTINE_ERROR_CODES as readonly string[]).includes(error.code)
				setSignProblem({text: error.code === "missing" ? t("branch.sign.missing") : known ? t(`branch.sign.errors.${error.code as (typeof DASTINE_ERROR_CODES)[number]}`) : t("branch.sign.failed"), missing: error.code === "missing"})
			} else setSignProblem({text: error.message || t("branch.sign.failed"), missing: false})
		},
	})

	const choose = async (file: File | undefined): Promise<void> => {
		setFileProblem(null)
		setSignProblem(null)
		check.reset()
		if (!file) return
		if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
			setFileProblem(t("branch.upload.notPdf"))
			onChange(null)
			return
		}
		const limit = maxKb.data ?? 0
		if (limit > 0 && file.size / 1024 > limit) {
			setFileProblem(t("branch.upload.tooBig", {size: (limit / 1024).toFixed(1)}))
			onChange(null)
			return
		}
		onChange({name: file.name, base64: await readAsBase64(file)})
	}

	return (
		<section className="flex flex-col gap-3 rounded-lg bg-card p-5" aria-labelledby="signed-pdf-title">
			<h2 id="signed-pdf-title" className="text-base font-semibold">
				{t("branch.upload.title")}
			</h2>
			<p className="text-sm text-muted-foreground">{t("branch.upload.hint")}</p>
			<ul className="flex flex-col gap-1 text-sm">
				{templateHref ? (
					<li>
						<a href={templateHref} className="underline underline-offset-4" download>
							{t("branch.upload.template")}
						</a>
					</li>
				) : null}
				<li>
					<a href="/files/DigitalSignatureGuide.pdf" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
						{t("branch.upload.guide")}
					</a>
				</li>
			</ul>
			<div className="flex flex-wrap items-center gap-3">
				<input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" id="signed-pdf" aria-invalid={invalid} onChange={(event) => void choose(event.target.files?.[0])} />
				<Button type="button" variant="outline" onClick={() => input.current?.click()}>
					<FileText aria-hidden="true" />
					{value ? t("branch.upload.replace") : t("branch.upload.choose")}
				</Button>
				{value ? <span dir="ltr" className="text-sm">{value.name}</span> : null}
				{value && !value.signed ? (
					<Button type="button" variant="secondary" disabled={sign.isPending} onClick={() => sign.mutate(value)}>
						<KeyRound aria-hidden="true" />
						{sign.isPending ? t("branch.sign.signing") : t("branch.sign.button")}
					</Button>
				) : null}
				{value ? (
					<Button type="button" variant="ghost" size="sm" disabled={check.isPending} onClick={() => check.mutate(value.base64)}>
						{check.isPending ? t("branch.upload.checking") : t("branch.upload.check")}
					</Button>
				) : null}
			</div>
			{value?.signed ? (
				<p role="status" className="text-sm font-medium text-success">
					{t("branch.sign.done")}
				</p>
			) : null}
			{signProblem ? (
				<p role="alert" className="text-sm text-destructive">
					{signProblem.text}{" "}
					{signProblem.missing && SIGN_APP_URL ? (
						<a href={SIGN_APP_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
							{t("branch.sign.download")}
						</a>
					) : null}
				</p>
			) : null}
			{check.isSuccess ? (
				<p role="status" className="text-sm font-medium text-success">
					{t("branch.upload.valid")}
				</p>
			) : null}
			{check.isError ? (
				<p role="alert" className="text-sm text-destructive">
					{check.error.message || t("branch.upload.invalid")}
				</p>
			) : null}
			{fileProblem ? (
				<p role="alert" className="text-sm text-destructive">
					{fileProblem}
				</p>
			) : null}
		</section>
	)
}
