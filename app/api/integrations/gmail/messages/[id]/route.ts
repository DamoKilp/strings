import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGmailConnectionStatus, getMessage } from '@/lib/gmail';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
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
    const message = await getMessage(user.id, params.id);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    return NextResponse.json({ message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch Gmail message';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}




