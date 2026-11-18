import {useMutation, useQuery} from "@tanstack/react-query"
import {FileText} from "lucide-react"
import {useRef, useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {checkDocument, getMaxDocumentKb} from "@/features/branch/api/intra"

export interface SignedPdf {
	name: string
	/** The file as base64, without the "data:" prefix. */
	base64: string
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

/**
 * Takes a PDF that has already been signed with the customer's digital certificate and checks it with the bank. The signing
 * itself is done outside the browser, with the bank's signing tool; this only uploads the result.
 */
export function SignedPdfUpload({value, onChange, accountNumber, templateHref, invalid = false}: Props) {
	const {t} = useTranslation()
	const input = useRef<HTMLInputElement>(null)
	const maxKb = useQuery({queryKey: ["branch", "max-document"], queryFn: getMaxDocumentKb, staleTime: 10 * 60_000, retry: false})
	const check = useMutation({mutationFn: (document: string) => checkDocument(document, accountNumber)})
	const [fileProblem, setFileProblem] = useState<string | null>(null)

	const choose = async (file: File | undefined): Promise<void> => {
		setFileProblem(null)
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
		<section className="flex flex-col gap-3 rounded-lg border bg-card p-5" aria-labelledby="signed-pdf-title">
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
				{value ? (
					<Button type="button" variant="ghost" size="sm" disabled={check.isPending} onClick={() => check.mutate(value.base64)}>
						{check.isPending ? t("branch.upload.checking") : t("branch.upload.check")}
					</Button>
				) : null}
			</div>
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
