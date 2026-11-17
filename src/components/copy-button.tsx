import {Check, Copy} from "lucide-react"
import {useState} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {logger} from "@/lib/logger"

interface CopyButtonProps {
	/** What lands on the clipboard. */
	value: string
	/** Accessible name, for example "Copy account number". */
	label: string
}

/** A small icon button that copies `value` and shows a tick for a moment. */
export function CopyButton({value, label}: CopyButtonProps) {
	const {t} = useTranslation()
	const [copied, setCopied] = useState(false)
	const Icon = copied ? Check : Copy

	const copy = async (): Promise<void> => {
		try {
			await navigator.clipboard.writeText(value)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1500)
		} catch (error) {
			// Clipboard access can be refused (insecure page, permissions); the value is still on screen to select.
			logger.warn("copy failed", {error: String(error)})
		}
	}

	return (
		<Button type="button" variant="ghost" size="icon" className="size-7" aria-label={label} onClick={() => void copy()}>
			<Icon aria-hidden="true" className="size-4" />
			<span role="status" className="sr-only">
				{copied ? t("copied") : ""}
			</span>
		</Button>
	)
}
