/**
 * Image Generation Tool - Generate images using Gemini's Nano Banana Pro model
 *
 * This tool generates actual images from text descriptions and returns them
 * both as base64 (for Claude to view) and saves them to disk (for user access).
 *
 * Nano Banana Pro Features:
 * - Up to 4K resolution
 * - 10 aspect ratios
 * - Google Search grounding for real-world accuracy
 * - High-fidelity text rendering
 */

import { exec } from 'child_process'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import sharp from 'sharp'
import { z } from 'zod'
import { generateImage, getOutputDir, type AspectRatio, type ImageSize, type ThinkingLevel } from '../gemini-client.js'
import { logger } from '../utils/logger.js'

/** Open a file with the OS default viewer (non-blocking, best-effort). */
function openFile(filePath: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  exec(`${cmd} "${filePath}"`, (err) => {
    if (err) logger.debug(`Could not auto-open file: ${err.message}`)
  })
}

// MCP tool results have a 1MB limit (enforced by Claude Desktop and other clients).
// We reserve room for text metadata alongside the image.
const MAX_BASE64_SIZE = 500_000

/**
 * Compress an image to JPEG that fits within the MCP size limit.
 * Returns the original if it already fits, otherwise returns a compressed preview.
 */
async function compressForInline(
  base64: string,
  mimeType: string
): Promise<{ data: string; mimeType: string; wasCompressed: boolean }> {
  if (base64.length <= MAX_BASE64_SIZE) {
    return { data: base64, mimeType, wasCompressed: false }
  }

  const inputBuffer = Buffer.from(base64, 'base64')

  // Try progressively lower quality until it fits
  for (const quality of [80, 60, 40]) {
    const compressed = await sharp(inputBuffer).jpeg({ quality }).toBuffer()
    const compressedBase64 = compressed.toString('base64')
    if (compressedBase64.length <= MAX_BASE64_SIZE) {
      logger.info(
        `Compressed preview: ${(base64.length / 1024).toFixed(0)}KB → ${(compressedBase64.length / 1024).toFixed(0)}KB (JPEG q${quality})`
      )
      return { data: compressedBase64, mimeType: 'image/jpeg', wasCompressed: true }
    }
  }

  // Last resort: resize down + low quality
  const metadata = await sharp(inputBuffer).metadata()
  const width = metadata.width ?? 1024
  const targetWidth = Math.min(width, 800)
  const compressed = await sharp(inputBuffer).resize(targetWidth).jpeg({ quality: 40 }).toBuffer()
  const compressedBase64 = compressed.toString('base64')
  logger.info(
    `Compressed preview (resized to ${targetWidth}px): ${(base64.length / 1024).toFixed(0)}KB → ${(compressedBase64.length / 1024).toFixed(0)}KB`
  )
  return { data: compressedBase64, mimeType: 'image/jpeg', wasCompressed: true }
}

/**
 * Register image generation tools with the MCP server
 */
export function registerImageGenTool(server: McpServer): void {
  // Image generation tool with full Nano Banana Pro capabilities
  server.tool(
    'gemini-generate-image',
    {
      prompt: z.string().describe('Description of the image to generate'),
      style: z
        .string()
        .optional()
        .describe('Art style (e.g., "photorealistic", "watercolor", "anime", "oil painting", "cyberpunk")'),
      aspectRatio: z
        .enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'])
        .default('1:1')
        .describe(
          'Aspect ratio: 1:1 (square), 16:9 (widescreen), 9:16 (portrait/mobile), 21:9 (ultrawide), 1:4/4:1 (tall/wide banner), 1:8/8:1 (extreme), etc.'
        ),
      imageSize: z
        .enum(['1K', '2K', '4K'])
        .default('2K')
        .describe('Resolution: 1K (fast), 2K (balanced, default), 4K (highest quality)'),
      thinkingLevel: z
        .enum(['minimal', 'low', 'medium', 'high'])
        .default('high')
        .describe('Reasoning depth: minimal (fastest), low, medium, high (best quality, default)'),
      useGoogleSearch: z
        .boolean()
        .default(true)
        .describe(
          'Ground the image in real-world info via Google Search (useful for current events, real places, etc.)'
        ),
    },
    async ({ prompt, style, aspectRatio, imageSize, thinkingLevel, useGoogleSearch }) => {
      logger.info(`Generating ${imageSize} image (thinking: ${thinkingLevel}): ${prompt.substring(0, 50)}...`)

      try {
        const result = await generateImage(prompt, {
          aspectRatio: aspectRatio as AspectRatio,
          imageSize: imageSize as ImageSize,
          style,
          saveToFile: true,
          useGoogleSearch,
          thinkingLevel: thinkingLevel as ThinkingLevel,
        })

        // Compress if needed to fit within MCP's 1MB tool result limit
        const preview = await compressForInline(result.base64, result.mimeType)

        // Auto-open so the user can see the full-res image immediately
        if (result.filePath) openFile(result.filePath)

        const statusText = `Image generated successfully!\n\nSettings: ${imageSize}, ${aspectRatio}, thinking: ${thinkingLevel}${useGoogleSearch ? ', with Google Search grounding' : ''}${preview.wasCompressed ? '\n\nNote: Showing compressed preview. Full-resolution image saved to disk.' : ''}\nSaved to: ${result.filePath}\nOutput directory: ${getOutputDir()}${result.description ? `\n\nGemini's description: ${result.description}` : ''}`

        return {
          content: [
            {
              type: 'image' as const,
              data: preview.data,
              mimeType: preview.mimeType,
              annotations: { audience: ['user'], priority: 1 },
            },
            {
              type: 'text' as const,
              text: statusText,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error generating image: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating image: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )

  // Legacy image prompt tool (for compatibility) - generates text prompts for other tools
  server.tool(
    'gemini-image-prompt',
    {
      description: z.string().describe('Description of the image to generate a prompt for'),
      style: z.string().optional().describe('The artistic style for the image'),
      mood: z.string().optional().describe('The mood or atmosphere of the image'),
      details: z.string().optional().describe('Additional details to include'),
    },
    async ({ description, style, mood, details }) => {
      logger.info(`Generating image prompt for: ${description}`)

      try {
        // Import the text generation function
        const { generateWithGeminiPro } = await import('../gemini-client.js')

        const prompt = `
You are an expert at creating detailed text-to-image prompts for generative AI art tools.
Based on the following description, create a highly detailed, structured prompt that would produce the best possible image.

Description: ${description}
${style ? `Style: ${style}` : ''}
${mood ? `Mood: ${mood}` : ''}
${details ? `Additional details: ${details}` : ''}

Format your response as follows:
1. A refined one-paragraph image prompt that's highly detailed and descriptive
2. Key elements that should be emphasized
3. Technical suggestions (like camera angle, lighting, etc.)
4. Style references that would work well

Use detail-rich, vivid language that generative AI image models would respond well to.
`

        const response = await generateWithGeminiPro(prompt)

        return {
          content: [
            {
              type: 'text' as const,
              text: response,
            },
          ],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Error generating image prompt: ${errorMessage}`)

        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
