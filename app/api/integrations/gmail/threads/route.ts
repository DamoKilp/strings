import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGmailConnectionStatus, listThreads } from '@/lib/gmail';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = await getGmailConnectionStatus(user.id);
  if (!status.connected || !status.canRead) {
    return NextResponse.json(
      { error: 'Gmail is not connected or missing read permission' },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const maxParam = searchParams.get('max');
    const label = searchParams.get('label');
    const unreadOnlyParam = searchParams.get('unreadOnly');

    const maxRaw = maxParam ? Number(maxParam) : 5;
    const maxResults = Number.isFinite(maxRaw) ? maxRaw : 5;
    const boundedMax = Math.min(Math.max(maxResults, 1), 20);

    const labelIds = label ? [label] : ['INBOX'];
    const unreadOnly =
      unreadOnlyParam === 'true' ||
      unreadOnlyParam === '1' ||
      unreadOnlyParam === 'yes';

    const threads = await listThreads(user.id, {
      maxResults: boundedMax,
      labelIds,
      unreadOnly,
    });

    return NextResponse.json({ threads });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list Gmail threads';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


