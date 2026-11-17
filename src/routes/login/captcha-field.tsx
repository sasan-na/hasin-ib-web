import {RefreshCw} from "lucide-react"
import type {Control} from "react-hook-form"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {FormControl, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form"
import {Input} from "@/components/ui/input"
import {normalizeDigits} from "@/lib/normalize-digits"

import {LOGIN_LIMITS, type LoginFormData} from "./loginSchema"
import type {CaptchaStatus} from "./useLoginForm"

interface CaptchaFieldProps {
	control: Control<LoginFormData>
	status: CaptchaStatus
	/** Base64 image data; null until the session is ready. */
	image: string | null
	onRefresh: () => void
}

export function CaptchaField({control, status, image, onRefresh}: CaptchaFieldProps) {
	const {t} = useTranslation("auth")

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<div className="flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-md border border-input bg-muted px-2">
					{status === "ready" && image ? (
						<img
							src={`data:image/jpeg;base64,${image}`}
							alt={t("login.captchaAlt")}
							className="h-10 max-w-full object-contain"
						/>
					) : null}
					{status === "loading" ? (
						<span role="status" className="text-sm text-muted-foreground">
							{t("login.captchaLoading")}
						</span>
					) : null}
					{status === "error" ? (
						<span role="alert" className="text-sm wrap-break-word text-destructive">
							{t("login.captchaError")}
						</span>
					) : null}
				</div>
				<Button type="button" variant="outline" size="icon" onClick={onRefresh} aria-label={t("login.captchaRefresh")}>
					<RefreshCw aria-hidden="true" />
				</Button>
			</div>
			<FormField
				control={control}
				name="captcha"
				render={({field}) => (
					<FormItem>
						<FormLabel>{t("login.captcha")}</FormLabel>
						<FormControl>
							<Input
								{...field}
								onChange={(event) => field.onChange(normalizeDigits(event.target.value))}
								inputMode="numeric"
								autoComplete="off"
								dir="ltr"
								maxLength={LOGIN_LIMITS.CAPTCHA_MAX}
								placeholder={t("login.captchaHint")}
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	)
}
