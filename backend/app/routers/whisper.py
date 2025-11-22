"""FastAPI router for Whisper speech-to-text endpoints."""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from app.services.whisper_service import WhisperService

router = APIRouter(prefix="/api/whisper", tags=["whisper"])

whisper_service = None


def get_whisper_service() -> WhisperService:
    """Get or initialize Whisper service."""
    global whisper_service
    if whisper_service is None:
        try:
            whisper_service = WhisperService()
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))
    return whisper_service


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(..., description="Audio file to transcribe"),
    language: str = Form("en", description="Language code (e.g., 'en', 'es', 'fr')"),
    service: WhisperService = Depends(get_whisper_service)
):
    """
    Transcribe audio to text using OpenAI Whisper API.
    
    Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
    
    Returns:
        JSON with transcript text
    """
    try:
        # Read audio file
        audio_bytes = await audio.read()
        
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")
        
        # Transcribe
        transcript = await service.transcribe_audio(
            audio_file=audio_bytes,
            language=language
        )
        
        if not transcript:
            raise HTTPException(status_code=500, detail="Transcription failed")
        
        return {"success": True, "transcript": transcript}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Transcription error: {str(e)}"
        )

