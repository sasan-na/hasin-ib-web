import {ChevronLeft, ChevronRight} from "lucide-react"
import {useCallback, useEffect, useRef, useState, type ReactNode} from "react"
import {useTranslation} from "react-i18next"

import {Button} from "@/components/ui/button"
import {cn} from "@/lib/utils"

interface SlideRowProps {
	children: ReactNode
	className?: string
	role?: string
	"aria-labelledby"?: string
	"aria-label"?: string
}

/**
 * One row of items that never wraps. When they do not fit, the row slides: swipe or scroll it, or use the arrows,
 * which only appear when there is something to slide to.
 */
export function SlideRow({children, className, role, "aria-labelledby": labelledBy, "aria-label": label}: SlideRowProps) {
	const {t} = useTranslation()
	const track = useRef<HTMLDivElement>(null)
	const [overflowing, setOverflowing] = useState(false)

	useEffect(() => {
		const element = track.current
		if (!element) return
		const measure = (): void => setOverflowing(element.scrollWidth > element.clientWidth + 1)
		const observer = new ResizeObserver(measure)
		observer.observe(element)
		// What is inside changes the width without changing the row's own size.
		const content = new MutationObserver(measure)
		content.observe(element, {childList: true, subtree: true})
		return () => {
			observer.disconnect()
			content.disconnect()
		}
	}, [])

	const slide = useCallback((direction: 1 | -1) => {
		const element = track.current
		if (!element) return
		// Scrolling goes the other way in a right-to-left page.
		const sign = getComputedStyle(element).direction === "rtl" ? -1 : 1
		element.scrollBy({left: direction * sign * element.clientWidth * 0.8, behavior: "smooth"})
	}, [])

	return (
		<div className="relative">
			<div
				ref={track}
				role={role}
				aria-labelledby={labelledBy}
				aria-label={label}
				className={cn("-mx-1 flex snap-x snap-mandatory overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
			>
				{children}
			</div>
			{overflowing ? (
				<div className="mt-2 flex justify-end gap-2">
					<Button type="button" variant="outline" size="icon-sm" aria-label={t("flow.slidePrevious")} onClick={() => slide(-1)}>
						<ChevronLeft aria-hidden="true" className="rtl:rotate-180" />
					</Button>
					<Button type="button" variant="outline" size="icon-sm" aria-label={t("flow.slideNext")} onClick={() => slide(1)}>
						<ChevronRight aria-hidden="true" className="rtl:rotate-180" />
					</Button>
				</div>
			) : null}
		</div>
	)
}
