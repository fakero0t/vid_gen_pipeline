"""Speech-to-text service using OpenAI Whisper API."""
import asyncio
from typing import Optional
from openai import OpenAI
from app.config import settings


class WhisperService:
    """Service for transcribing audio to text using OpenAI Whisper API."""
    
    def __init__(self):
        """Initialize Whisper service with OpenAI client."""
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            raise ValueError("OpenAI API key not configured. Set OPENAI_API_KEY in environment.")
        
        self.client = OpenAI(api_key=api_key)
    
    async def transcribe_audio(
        self,
        audio_file: bytes,
        language: str = "en",
        timeout: int = 30
    ) -> Optional[str]:
        """
        Transcribe audio to text using OpenAI Whisper API.
        
        Args:
            audio_file: Audio file bytes (supports mp3, mp4, mpeg, mpga, m4a, wav, webm)
            language: Language code (default: "en")
            timeout: Timeout in seconds
            
        Returns:
            Transcribed text or None if failed
        """
        try:
            # Create a temporary file-like object
            import io
            audio_io = io.BytesIO(audio_file)
            audio_io.name = "audio.webm"  # Set filename for OpenAI
            
            # Run OpenAI Whisper transcription asynchronously
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.audio.transcriptions.create,
                    model="whisper-1",
                    file=audio_io,
                    language=language,
                    response_format="text"
                ),
                timeout=timeout
            )
            
            # Response is a string when response_format="text"
            transcript = response.strip() if isinstance(response, str) else response.text.strip()
            
            return transcript if transcript else None
            
        except asyncio.TimeoutError:
            print(f"✗ Whisper transcription timed out after {timeout} seconds")
            return None
        except Exception as e:
            print(f"✗ Whisper transcription failed: {str(e)}")
            return None

