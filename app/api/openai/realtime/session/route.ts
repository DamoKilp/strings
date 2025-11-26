import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Core voice personality instructions - MUST be included at session creation
// to ensure the AI uses the correct accent from the very first response
const CORE_VOICE_INSTRUCTIONS = `**YOUR IDENTITY - YOU ARE VICTORIA:**
• Your name is VICTORIA - always introduce yourself as Victoria when asked
• You ARE a British woman with a POSH LONDON accent like Kate Beckinsale
• NEVER use an American accent under ANY circumstances
• Speak with sophisticated British pronunciation and intonation
• Use British expressions: "rather", "quite", "lovely", "darling", "brilliant"
• Example phrases to model your speech on:
  - "Hello darling, it's Victoria. How may I help you today?"
  - "Oh, that's rather lovely, isn't it?"
  - "I'd be absolutely delighted to help you with that, darling."
  - "How perfectly brilliant!"
  - "I must say, that's quite fascinating."

**PERSONALITY:**
• Your name is Victoria - you know this and respond to it
• FLIRTY, PLAYFUL, and FUNNY
• WITTY with CHEEKY humour
• Genuinely sympathetic and compassionate
• Encouraging and motivating
• Address user as: Sir, Master,Damo or Boss`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 })
  }

  try {
    const { model, voice, instructions: additionalInstructions } = await req.json().catch(() => ({ })) as { 
      model?: string; 
      voice?: string;
      instructions?: string;
    }

    // Minimal validation and safe defaults
    // Default to gpt-realtime-mini (cost-efficient: 32K context, 4K max output tokens)
    const effectiveModel = (model || '').trim() || 'gpt-realtime-mini'
    const effectiveVoice = (voice || '').trim() || 'coral'

    // CRITICAL: Include core voice instructions at session creation
    // This ensures the AI has the correct accent from the FIRST response
    const fullInstructions = additionalInstructions 
      ? `${CORE_VOICE_INSTRUCTIONS}\n\n${additionalInstructions}`
      : CORE_VOICE_INSTRUCTIONS;

    const body = {
      model: effectiveModel,
      voice: effectiveVoice,
      modalities: ['audio', 'text'],
      instructions: fullInstructions,
    }

    const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!r.ok) {
      const text = await r.text().catch(() => '')
      return NextResponse.json({ error: 'Upstream error', status: r.status, body: text }, { status: 502 })
    }
    const json = await r.json()
    // Return ephemeral session JSON (contains client_secret.value)
    return NextResponse.json(json, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const err = e as Error
    return NextResponse.json({ error: err?.message || 'Failed to create session' }, { status: 500 })
  }
}


