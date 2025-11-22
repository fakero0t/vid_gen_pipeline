import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string || 'en';

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Forward to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const backendFormData = new FormData();
    backendFormData.append('audio', audioFile);
    backendFormData.append('language', language);

    const response = await fetch(`${backendUrl}/api/whisper/transcribe`, {
      method: 'POST',
      body: backendFormData,
    });

    if (!response.ok) {
      throw new Error('Backend transcription failed');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Whisper API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}

