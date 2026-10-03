import { NextRequest, NextResponse } from 'next/server';
import { extractUserCredentials } from '@/lib/higgsfield-server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const credsResult = extractUserCredentials(req);
  if (!credsResult.ok) return credsResult.response;

  try {
    const { slotId, mediaKind } = (await req.json()) as {
      slotId?: string;
      mediaKind?: 'image' | 'video';
    };

    if (!slotId) {
      return NextResponse.json({ ok: true });
    }

    const res = await fetch(
      `https://api.higgsfield.ai/v1/agent/media/${encodeURIComponent(slotId)}/confirm`,
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${credsResult.credentials.keyId}:${credsResult.credentials.keySecret}`,
          'hf-api-key': credsResult.credentials.keyId,
          'hf-secret': credsResult.credentials.keySecret,
          'Content-Type': 'application/json',
          'User-Agent': 'higgsfield-server-js/2.0',
        },
        body: JSON.stringify({ type: mediaKind === 'video' ? 'video' : 'image' }),
      }
    );

    return NextResponse.json({ ok: res.ok });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
