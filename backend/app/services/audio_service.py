"""Audio generation service using Replicate API."""
import asyncio
from typing import Optional, Dict, Any, List
import replicate
from app.config import settings


class AudioGenerationService:
    """Service for generating background music using Replicate API."""

    # Stability AI Stable Audio 2.5 model - generates music from text prompts
    # Supports variable duration audio generation
    PRODUCTION_AUDIO_MODEL = "stability-ai/stable-audio-2.5"

    # Development model: Same model
    DEVELOPMENT_AUDIO_MODEL = "stability-ai/stable-audio-2.5"

    def __init__(self):
        """Initialize the audio generation service with API token."""
        token = settings.get_replicate_token()
        if not token:
            raise ValueError("Replicate API token not configured. Set REPLICATE_API_TOKEN in environment.")

        # Set the token for replicate client
        self.client = replicate.Client(api_token=token)

        # Determine which model to use based on environment
        if settings.is_development():
            self.default_model = self.DEVELOPMENT_AUDIO_MODEL
        else:
            self.default_model = self.PRODUCTION_AUDIO_MODEL

    def build_music_prompt(
        self,
        mood_name: str,
        mood_description: str,
        emotional_tone: List[str],
        aesthetic_direction: str,
        style_keywords: Optional[List[str]] = None
    ) -> str:
        """
        Build a detailed music generation prompt from mood and creative brief data.

        Args:
            mood_name: Name of the mood (e.g., "Energetic", "Calm")
            mood_description: Detailed description of the mood
            emotional_tone: List of emotional tones from creative brief
            aesthetic_direction: Overall aesthetic direction
            style_keywords: Optional list of visual style keywords

        Returns:
            Formatted prompt string for music generation
        """
        # Build prompt components for instrumental background music
        components = []

        # Start with the mood and emotional tone
        components.append(f"{mood_name} instrumental background music")

        # Add emotional characteristics
        if emotional_tone:
            tone_str = ', '.join(emotional_tone[:3])  # Limit to top 3 tones
            components.append(f"emotional tone: {tone_str}")

        # Add mood-specific characteristics
        # Extract key adjectives from mood description
        mood_keywords = mood_description.lower().split('.')[:2]  # First 2 sentences
        if mood_keywords:
            components.append(f"style: {' '.join(mood_keywords)}")

        # Add aesthetic direction
        components.append(f"aesthetic: {aesthetic_direction}")

        # Add musical characteristics based on style keywords
        if style_keywords:
            # Map visual styles to musical characteristics
            style_mappings = {
                'modern': 'electronic, contemporary',
                'vintage': 'retro, analog',
                'minimalist': 'simple, clean melody',
                'bold': 'powerful, dynamic',
                'elegant': 'sophisticated, smooth',
                'energetic': 'upbeat, fast tempo',
                'calm': 'peaceful, slow tempo',
                'cinematic': 'orchestral, atmospheric'
            }

            musical_styles = []
            for keyword in style_keywords[:3]:  # Limit to 3 keywords
                keyword_lower = keyword.lower()
                for style, music in style_mappings.items():
                    if style in keyword_lower:
                        musical_styles.append(music)
                        break

            if musical_styles:
                components.append(f"musical style: {', '.join(musical_styles)}")

        # Specify instrumental and background characteristics
        components.append("no vocals, instrumental only")
        components.append("suitable for video background")
        components.append("consistent volume and energy")

        # Join all components
        prompt = ", ".join(components)

        # Ensure prompt isn't too long
        if len(prompt) > 500:
            prompt = prompt[:497] + "..."

        return prompt

    async def generate_music(
        self,
        prompt: str,
        duration: int = 30,
        steps: int = 8,
        cfg_scale: float = 1.0,
        model: Optional[str] = None,
        timeout: int = 300
    ) -> Optional[str]:
        """
        Generate background music from a text prompt using Stable Audio 2.5.

        Args:
            prompt: Text description of the music to generate
            duration: Duration in seconds (variable, default: 30)
            steps: Number of inference steps (default: 8)
            cfg_scale: Classifier-free guidance scale (default: 1.0)
            model: Optional model identifier (uses default if not provided)
            timeout: Timeout in seconds (default: 300)

        Returns:
            Audio URL or None if generation failed
        """
        model_id = model or self.default_model

        # Build input parameters for Stable Audio 2.5
        # Format: {"steps": 8, "prompt": "...", "duration": <seconds>, "cfg_scale": 1}
        input_params = {
            "steps": steps,
            "prompt": prompt,
            "duration": duration,
            "cfg_scale": cfg_scale
        }

        try:
            print(f"Generating {duration}s music: '{prompt[:60]}...'")

            # Run the model asynchronously with timeout
            output = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.run,
                    model_id,
                    input=input_params
                ),
                timeout=timeout
            )

            # Handle different output formats
            if isinstance(output, str):
                print(f"✓ Music generated successfully")
                return output
            elif isinstance(output, list) and len(output) > 0:
                print(f"✓ Music generated successfully")
                return str(output[0])
            elif hasattr(output, 'url'):
                print(f"✓ Music generated successfully")
                return str(output.url)
            else:
                print(f"✗ Unexpected output format: {type(output)}")
                return None

        except asyncio.TimeoutError:
            print(f"✗ Music generation timed out after {timeout} seconds")
            return None
        except Exception as e:
            error_msg = str(e)
            print(f"✗ Music generation failed: {error_msg}")
            return None

    async def generate_music_for_mood(
        self,
        mood_name: str,
        mood_description: str,
        emotional_tone: List[str],
        aesthetic_direction: str,
        style_keywords: Optional[List[str]] = None,
        duration: int = 30
    ) -> Dict[str, Any]:
        """
        Generate background music tailored to a specific mood.

        Args:
            mood_name: Name of the mood
            mood_description: Description of the mood
            emotional_tone: List of emotional tones
            aesthetic_direction: Overall aesthetic direction
            style_keywords: Optional list of style keywords
            duration: Duration in seconds (variable, default: 30)

        Returns:
            Dictionary with generation results:
                - success: Boolean indicating success
                - audio_url: URL of generated audio (if successful)
                - prompt: The prompt used for generation
                - duration: Actual duration of generated audio
                - error: Error message (if failed)
        """
        try:
            # Build the music prompt
            prompt = self.build_music_prompt(
                mood_name=mood_name,
                mood_description=mood_description,
                emotional_tone=emotional_tone,
                aesthetic_direction=aesthetic_direction,
                style_keywords=style_keywords
            )

            # Generate the music
            audio_url = await self.generate_music(
                prompt=prompt,
                duration=duration
            )

            if audio_url:
                return {
                    "success": True,
                    "audio_url": audio_url,
                    "prompt": prompt,
                    "duration": duration,
                    "error": None
                }
            else:
                return {
                    "success": False,
                    "audio_url": None,
                    "prompt": prompt,
                    "duration": 0,
                    "error": "Music generation returned no output"
                }

        except Exception as e:
            error_msg = str(e)
            return {
                "success": False,
                "audio_url": None,
                "prompt": "",
                "duration": 0,
                "error": f"Music generation error: {error_msg}"
            }

    async def generate_music_with_custom_prompt(
        self,
        prompt: str,
        duration: int = 30,
        max_retries: int = 2,
        base_delay: float = 2.0
    ) -> Dict[str, Any]:
        """
        Generate music with a custom prompt and exponential backoff retry logic.

        Args:
            prompt: Custom prompt string to use for generation
            duration: Duration in seconds (variable)
            max_retries: Maximum number of retry attempts
            base_delay: Base delay in seconds for exponential backoff

        Returns:
            Dictionary with generation results
        """
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                if attempt > 0:
                    print(f"Music generation: Attempt {attempt + 1}/{max_retries + 1}")

                audio_url = await self.generate_music(
                    prompt=prompt,
                    duration=duration
                )

                if audio_url:
                    if attempt > 0:
                        print(f"✓ Music generation succeeded after {attempt} retries")
                    return {
                        "success": True,
                        "audio_url": audio_url,
                        "prompt": prompt,
                        "duration": duration,
                        "error": None
                    }

                last_error = "Music generation returned no output"

            except Exception as e:
                last_error = str(e)
                print(f"✗ Music generation attempt {attempt + 1} failed: {last_error}")

                # If last attempt, don't retry
                if attempt == max_retries:
                    break

                # Calculate exponential backoff delay
                delay = base_delay * (2 ** attempt)
                print(f"⏳ Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)

        # All attempts failed
        return {
            "success": False,
            "audio_url": None,
            "prompt": prompt,
            "duration": 0,
            "error": f"Music generation failed after {max_retries + 1} attempts: {last_error}"
        }

    async def generate_music_with_retry(
        self,
        mood_name: str,
        mood_description: str,
        emotional_tone: List[str],
        aesthetic_direction: str,
        style_keywords: Optional[List[str]] = None,
        duration: int = 30,
        max_retries: int = 2,
        base_delay: float = 2.0
    ) -> Dict[str, Any]:
        """
        Generate music with exponential backoff retry logic.

        Args:
            mood_name: Name of the mood
            mood_description: Description of the mood
            emotional_tone: List of emotional tones
            aesthetic_direction: Overall aesthetic direction
            style_keywords: Optional list of style keywords
            duration: Duration in seconds (variable)
            max_retries: Maximum number of retry attempts
            base_delay: Base delay in seconds for exponential backoff

        Returns:
            Dictionary with generation results
        """
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                if attempt > 0:
                    print(f"Music generation: Attempt {attempt + 1}/{max_retries + 1}")

                result = await self.generate_music_for_mood(
                    mood_name=mood_name,
                    mood_description=mood_description,
                    emotional_tone=emotional_tone,
                    aesthetic_direction=aesthetic_direction,
                    style_keywords=style_keywords,
                    duration=duration
                )

                if result["success"]:
                    if attempt > 0:
                        print(f"✓ Music generation succeeded after {attempt} retries")
                    return result

                last_error = result.get("error", "Unknown error")

            except Exception as e:
                last_error = str(e)
                print(f"✗ Music generation attempt {attempt + 1} failed: {last_error}")

                # If last attempt, don't retry
                if attempt == max_retries:
                    break

                # Calculate exponential backoff delay
                delay = base_delay * (2 ** attempt)
                print(f"⏳ Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)

        # All attempts failed
        return {
            "success": False,
            "audio_url": None,
            "prompt": "",
            "duration": 0,
            "error": f"Music generation failed after {max_retries + 1} attempts: {last_error}"
        }
