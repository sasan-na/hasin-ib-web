import {z} from "@/lib/zod"

import {apiClient} from "@/lib/api/client"

// Signing a PDF has two steps on the bank's side, with the customer's token in between: the bank prepares the document and
// returns a digest to be signed, the token signs it, and the bank puts the signature into the PDF. These answers keep the
// bank's own field names (such as "digest_Result"), so they are read as they come.

export interface PdfSignRequest {
	/** The customer's certificate, from the token. */
	signerCertificate: string
	/** The PDF as base64 (no "data:" prefix). */
	pdfData: string
	dateTime: string
	/** A small PNG (base64, no prefix) drawn on the page as the visible mark of the signature. */
	imageDataUrl: string
	signatureFieldName: string
	nationalCode: string
}

/** Where the visible signature goes on the first page, in the bank's units. */
const PLACE = {page: 1, lowerLeftX: 140, lowerLeftY: 65, upperRightX: 710, upperRightY: 90}
/** The bank's number for SHA-256. */
const HASH_ALGORITHM = 1

const body = (request: PdfSignRequest) => ({...request, reason: "", location: "", ...PLACE, hashAlgorithm: HASH_ALGORITHM})

const digestSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), result: z.object({variables: z.object({digest_Result: z.string().nullish()}).nullish()}).nullish()})

/** Asks the bank to prepare the document for signing. Resolves with the digest the token has to sign. Nothing is recorded yet. */
export const requestDigest = async (request: PdfSignRequest): Promise<string> => {
	const data = digestSchema.parse(await apiClient<unknown>("/Intra/Sign", {method: "POST", body: JSON.stringify(body(request))}))
	const digest = data.result?.variables?.digest_Result
	if (data.isSuccessful === false || !digest) throw new Error(data.message ?? "")
	return digest
}

const finalSchema = z.object({isSuccessful: z.boolean().nullish(), message: z.string().nullish(), result: z.object({variables: z.object({ppsignature_Result: z.string().nullish()}).nullish()}).nullish()})

/** Gives the bank the token's signature. Resolves with the signed PDF as base64. */
export const finishSignature = async (request: PdfSignRequest, digest: string, signature: string): Promise<string> => {
	const data = finalSchema.parse(await apiClient<unknown>("/Promissory/SignStepFinal", {method: "POST", body: JSON.stringify({...body(request), signature, data: digest})}))
	const signed = data.result?.variables?.ppsignature_Result
	if (data.isSuccessful === false || !signed) throw new Error(data.message ?? "")
	return signed
}

/** Draws the sentence that appears on the signed page as a PNG (base64, no "data:" prefix). */
export const drawStamp = (text: string): string => {
	const canvas = document.createElement("canvas")
	const context = canvas.getContext("2d")
	if (!context) return ""
	context.font = "20px Tahoma"
	canvas.width = Math.ceil(context.measureText(text).width) + 20
	canvas.height = 50
	// Resizing the canvas resets its state, so the style is set again.
	context.font = "20px Tahoma"
	context.fillStyle = "black"
	context.fillText(text, 10, 30)
	return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "")
}
