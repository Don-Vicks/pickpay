// Grades a bag photo with Claude vision: polymer type and contamination, which set the price.
import Anthropic from '@anthropic-ai/sdk'
import type { PolymerName } from './pricing'

export type Grade = {
  isPlastic: boolean
  polymer: PolymerName
  contaminationBps: number
  confidence: 'low' | 'medium' | 'high'
  notes: string
}

export class GradeRefusedError extends Error {}

const MODEL = 'claude-opus-5-5'

const SYSTEM = `You grade bags of post-consumer plastic at a recycling collection hub in Lagos, Nigeria.
The hub pays waste pickers per kilogram, and your grade sets the price, so be accurate and consistent.

From the photo, decide:
- isPlastic: false if the photo does not show collected plastic waste (a person, a screenshot, an unrelated object). Then the other fields don't matter.
- polymer: "pet" if the bag is mostly clear or light-blue PET bottles (water, soft-drink bottles); "hdpe" if mostly opaque rigid containers (milk, detergent, oil jerrycans); "mixed" if no single type is at least about 80% of the visible items, or it includes films, sachets or other plastics.
- contaminationBps: estimated share of the load that is not recyclable as graded, in basis points (0-10000): dirt, liquids, food residue, non-plastic items, other plastic types mixed in. Labels and caps on bottles are normal and do not count.
- confidence: how sure you are, given photo quality and how much of the load is visible.
- notes: one short sentence a hub agent could read to the picker explaining the grade.`

const SCHEMA = {
  type: 'object',
  properties: {
    isPlastic: { type: 'boolean' },
    polymer: { type: 'string', enum: ['pet', 'hdpe', 'mixed'] },
    // Range (0-10000) is checked after parsing: structured outputs reject integer min/max.
    contaminationBps: { type: 'integer' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    notes: { type: 'string' },
  },
  required: ['isPlastic', 'polymer', 'contaminationBps', 'confidence', 'notes'],
  additionalProperties: false,
} as const

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

const client = new Anthropic()

export async function gradePhoto(imageBase64: string, mediaType: ImageMediaType): Promise<Grade> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2_000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // A single photo classification: low effort keeps the hub queue moving.
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Grade this bag.' },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    throw new GradeRefusedError(response.stop_details?.explanation ?? 'The model declined to grade this photo')
  }
  const text = response.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error(`No grade returned (stop_reason: ${response.stop_reason})`)
  const grade = JSON.parse(text.text) as Grade
  if (!['pet', 'hdpe', 'mixed'].includes(grade.polymer)) throw new Error(`Unexpected polymer: ${grade.polymer}`)
  if (!Number.isInteger(grade.contaminationBps) || grade.contaminationBps < 0 || grade.contaminationBps > 10_000) {
    throw new Error(`Unexpected contaminationBps: ${grade.contaminationBps}`)
  }
  return grade
}
