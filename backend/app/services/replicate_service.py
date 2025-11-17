"""Replicate API service for image and video generation."""
import asyncio
from typing import List, Dict, Any, Optional
import replicate
from app.config import settings


class ReplicateImageService:
    """Service for generating images using Replicate API."""
    
    # Production model: SDXL (higher quality, more expensive, slower)
    # Quality: Excellent detail, great prompt following, professional results
    # Speed: ~30-60 seconds per 1080x1920 image
    # Verified model on Replicate
    PRODUCTION_IMAGE_MODEL = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
    
    # Development model: Use SDXL with optimized settings (same model, faster params)
    # We use the same SDXL model but with:
    # - Lower resolution (640x1136 vs 1080x1920) = 4x faster
    # - Fewer inference steps (20 vs 50) = 2.5x faster
    # - Lower guidance scale = slightly faster
    # This is verified to work and is much faster while still using a real model
    DEVELOPMENT_IMAGE_MODEL = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
    
    def __init__(self):
        """Initialize the Replicate service with API token."""
        token = settings.get_replicate_token()
        if not token:
            raise ValueError("Replicate API token not configured. Set REPLICATE_API_TOKEN in environment.")
        
        # Set the token for replicate client
        self.client = replicate.Client(api_token=token)
        
        # Determine which model to use based on environment
        if settings.REPLICATE_IMAGE_MODEL:
            # Use explicitly configured model
            self.default_model = settings.REPLICATE_IMAGE_MODEL
        elif settings.is_development():
            # Use cheaper model in development
            self.default_model = self.DEVELOPMENT_IMAGE_MODEL
        else:
            # Use production model
            self.default_model = self.PRODUCTION_IMAGE_MODEL
    
    async def generate_image(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        num_outputs: int = 1,
        model: Optional[str] = None,
        timeout: int = 120,  # 2 minute timeout per image
        num_inference_steps: Optional[int] = None,  # Lower = faster, higher = better quality
        guidance_scale: Optional[float] = None  # How closely to follow prompt
    ) -> List[str]:
        """
        Generate image(s) from a text prompt using Replicate.
        
        Args:
            prompt: Text description of the image to generate
            width: Image width in pixels (default: 1024)
            height: Image height in pixels (default: 1024)
            num_outputs: Number of images to generate (default: 1)
            model: Optional model identifier (uses default if not provided)
            timeout: Timeout in seconds (default: 120)
        
        Returns:
            List of image URLs
        """
        model_id = model or self.default_model
        
        # Optimize parameters based on environment
        # Lower steps = faster generation (good for dev)
        # Higher steps = better quality (good for prod)
        if num_inference_steps is None:
            if settings.is_development():
                num_inference_steps = 20  # Faster for dev, still good quality
            else:
                num_inference_steps = 50  # Higher quality for prod
        
        # Guidance scale: how closely to follow the prompt
        if guidance_scale is None:
            if settings.is_development():
                guidance_scale = 7.0  # Good balance for dev
            else:
                guidance_scale = 7.5  # Higher = better prompt adherence
        
        # Build input parameters
        input_params = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "num_outputs": num_outputs
        }
        
        # Add optimization parameters - SDXL supports these
        if "sdxl" in model_id.lower():
            input_params["num_inference_steps"] = num_inference_steps
            input_params["guidance_scale"] = guidance_scale
        
        try:
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
            if isinstance(output, list):
                return [str(url) for url in output]
            elif isinstance(output, str):
                return [output]
            else:
                return [str(output)]
                
        except asyncio.TimeoutError:
            raise RuntimeError(f"Image generation timed out after {timeout} seconds")
        except Exception as e:
            raise RuntimeError(f"Failed to generate image with Replicate: {str(e)}")
    
    async def generate_images_parallel(
        self,
        prompts: List[str],
        width: int = 1024,
        height: int = 1024,
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple images in parallel from a list of prompts.
        
        Args:
            prompts: List of text prompts for image generation
            width: Image width in pixels (default: 1024)
            height: Image height in pixels (default: 1024)
            model: Optional model identifier
        
        Returns:
            List of dictionaries with keys:
                - prompt: The original prompt
                - image_url: The generated image URL
                - success: Boolean indicating success
                - error: Error message if failed
        """
        # Create tasks for parallel execution
        tasks = [
            self._generate_single_image_safe(prompt, width, height, model)
            for prompt in prompts
        ]
        
        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Format results
        formatted_results = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                formatted_results.append({
                    "prompt": prompts[idx],
                    "image_url": None,
                    "success": False,
                    "error": str(result)
                })
            elif result is None:
                # Timeout or other error that returned None
                formatted_results.append({
                    "prompt": prompts[idx],
                    "image_url": None,
                    "success": False,
                    "error": "Generation failed or timed out"
                })
            elif isinstance(result, list) and len(result) > 0:
                formatted_results.append({
                    "prompt": prompts[idx],
                    "image_url": str(result[0]),
                    "success": True,
                    "error": None
                })
            else:
                # Empty result or unexpected format
                formatted_results.append({
                    "prompt": prompts[idx],
                    "image_url": None,
                    "success": False,
                    "error": "No image generated"
                })
        
        return formatted_results
    
    async def _generate_single_image_safe(
        self,
        prompt: str,
        width: int,
        height: int,
        model: Optional[str]
    ) -> Optional[List[str]]:
        """Safely generate a single image with error handling and timeout."""
        try:
            # Adjust timeout based on environment and resolution
            # Dev: Lower resolution + fewer steps = shorter timeout
            # Prod: Higher resolution + more steps = longer timeout
            if settings.is_development():
                timeout = 60  # Dev: SDXL at 640x1136 with 20 steps should finish in ~20-40s
            else:
                timeout = 90  # Prod: SDXL at 1080x1920 with 50 steps can take 30-60s
            
            return await self.generate_image(prompt, width, height, 1, model, timeout=timeout)
        except asyncio.TimeoutError:
            print(f"Timeout generating image for prompt '{prompt[:50]}...'")
            return None
        except Exception as e:
            # Log error but don't raise - let caller handle it
            error_msg = str(e)
            # Don't log full NSFW error messages, just note the issue
            if "NSFW" in error_msg.upper():
                print(f"Content filter triggered for prompt '{prompt[:50]}...'")
            else:
                print(f"Error generating image for prompt '{prompt[:50]}...': {error_msg}")
            return None
    
    def build_image_prompt(
        self,
        mood_name: str,
        mood_description: str,
        style_keywords: List[str],
        color_palette: List[str],
        aesthetic_direction: str,
        product_name: Optional[str] = None
    ) -> str:
        """
        Build a detailed image generation prompt from mood data.
        Designed to be safe and avoid NSFW content filters.
        
        Args:
            mood_name: Name of the mood
            mood_description: Detailed description of the mood
            style_keywords: List of visual style keywords
            color_palette: List of colors for the mood
            aesthetic_direction: Overall aesthetic direction
            product_name: Optional product name for context
        
        Returns:
            Formatted prompt string for image generation
        """
        # Build the prompt components - keep it clean and professional
        components = []
        
        # Start with style and aesthetic (most important)
        components.append(f"Visual style: {', '.join(style_keywords[:5])}")  # Limit keywords
        
        # Add aesthetic direction
        components.append(f"Aesthetic: {aesthetic_direction}")
        
        # Add color palette if available
        if color_palette:
            colors = ', '.join(color_palette[:4])  # Limit colors
            components.append(f"Color palette: {colors}")
        
        # Add mood description (sanitized)
        # Remove any potentially problematic words from description
        clean_description = mood_description.lower()
        # Keep only the first sentence or first 100 chars
        description_parts = clean_description.split('.')[0][:100]
        components.append(f"Mood: {description_parts}")
        
        # Add quality and format specifications - keep it professional
        components.append("Professional product photography")
        components.append("Clean, modern composition")
        components.append("Vertical 9:16 aspect ratio")
        components.append("High quality, commercial style")
        components.append("Suitable for advertising and marketing")
        
        # Explicitly avoid problematic content
        components.append("SFW, family-friendly, professional content only")
        
        prompt = ", ".join(components)
        return prompt

    def build_scene_seed_prompt(
        self,
        scene_description: str,
        scene_style_prompt: str,
        mood_style_keywords: List[str],
        mood_color_palette: List[str],
        mood_aesthetic_direction: str
    ) -> str:
        """
        Build a detailed image generation prompt for a scene seed image.
        Combines scene-specific description with mood styling for consistency.

        Args:
            scene_description: Description of what happens in the scene
            scene_style_prompt: Style keywords specific to this scene
            mood_style_keywords: Style keywords from selected mood
            mood_color_palette: Color palette from selected mood
            mood_aesthetic_direction: Overall aesthetic from selected mood

        Returns:
            Formatted prompt string for seed image generation
        """
        # Build the prompt components - prioritize scene description with mood styling
        components = []

        # Start with the scene content (what to show)
        components.append(scene_description)

        # Add scene-specific style
        components.append(f"Style: {scene_style_prompt}")

        # Add mood aesthetic for consistency across all scenes
        components.append(f"Overall aesthetic: {mood_aesthetic_direction}")

        # Add mood style keywords for visual consistency
        if mood_style_keywords:
            style_kw = ', '.join(mood_style_keywords[:5])
            components.append(f"Visual style: {style_kw}")

        # Add color palette for consistency
        if mood_color_palette:
            colors = ', '.join(mood_color_palette[:4])
            components.append(f"Color palette: {colors}")

        # Add quality specifications
        components.append("Professional cinematic frame")
        components.append("Vertical 9:16 aspect ratio")
        components.append("High quality, suitable for video production")
        components.append("Clean composition")

        # Keep it safe and professional
        components.append("SFW, professional content only")

        prompt = ", ".join(components)
        return prompt

    async def generate_scene_seed_images(
        self,
        scenes: List[Dict[str, Any]],
        mood_style_keywords: List[str],
        mood_color_palette: List[str],
        mood_aesthetic_direction: str,
        width: int = 1080,
        height: int = 1920
    ) -> List[Dict[str, Any]]:
        """
        Generate seed images for multiple scenes in parallel.

        Args:
            scenes: List of scene dictionaries with description and style_prompt
            mood_style_keywords: Style keywords from selected mood
            mood_color_palette: Color palette from selected mood
            mood_aesthetic_direction: Aesthetic direction from selected mood
            width: Image width (default: 1080 for prod quality)
            height: Image height (default: 1920 for 9:16 vertical)

        Returns:
            List of dictionaries with scene data and generated image URLs
        """
        # Build prompts for all scenes
        prompts = []
        for scene in scenes:
            prompt = self.build_scene_seed_prompt(
                scene_description=scene.get("description", ""),
                scene_style_prompt=scene.get("style_prompt", ""),
                mood_style_keywords=mood_style_keywords,
                mood_color_palette=mood_color_palette,
                mood_aesthetic_direction=mood_aesthetic_direction
            )
            prompts.append(prompt)

        # Generate all images in parallel
        print(f"Starting parallel generation of {len(prompts)} seed images at {width}x{height}...")
        image_results = await self.generate_images_parallel(
            prompts=prompts,
            width=width,
            height=height
        )
        print(f"Completed seed image generation: {sum(1 for r in image_results if r['success'])}/{len(image_results)} successful")

        # Combine scene data with image results
        results = []
        for idx, (scene, image_result) in enumerate(zip(scenes, image_results)):
            result = {
                "scene_number": scene.get("scene_number", idx + 1),
                "duration": scene.get("duration", 0),
                "description": scene.get("description", ""),
                "style_prompt": scene.get("style_prompt", ""),
                "seed_image_url": image_result.get("image_url"),
                "generation_success": image_result.get("success", False),
                "generation_error": image_result.get("error")
            }
            results.append(result)

        return results


class ReplicateVideoService:
    """Service for generating videos using Replicate API img2vid models."""

    # Production model: MiniMax Video-01-Director (high quality, supports 6s clips)
    # Professional grade video generation from images
    PRODUCTION_VIDEO_MODEL = "minimax/video-01-director"

    # Development model: Zeroscope v2 XL (faster, cheaper for dev)
    DEVELOPMENT_VIDEO_MODEL = "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351"

    def __init__(self):
        """Initialize the Replicate video service with API token."""
        token = settings.get_replicate_token()
        if not token:
            raise ValueError("Replicate API token not configured. Set REPLICATE_API_TOKEN in environment.")

        # Set the token for replicate client
        self.client = replicate.Client(api_token=token)

        # Determine which model to use based on environment
        if settings.is_development():
            self.default_model = self.DEVELOPMENT_VIDEO_MODEL
        else:
            self.default_model = self.PRODUCTION_VIDEO_MODEL

    async def generate_video_from_image(
        self,
        image_url: str,
        duration_seconds: float = 4.0,
        fps: int = 8,
        motion_bucket_id: int = 127,
        cond_aug: float = 0.02,
        model: Optional[str] = None,
        timeout: int = 300  # 5 minute timeout for video generation
    ) -> Optional[str]:
        """
        Generate a video from a seed image using Replicate's img2vid model.

        Args:
            image_url: URL of the seed image
            duration_seconds: Target duration in seconds (3-10 seconds supported)
            fps: Frames per second (default: 8 for Zeroscope)
            motion_bucket_id: Amount of motion (unused for Zeroscope, kept for compatibility)
            cond_aug: Conditioning augmentation (unused for Zeroscope, kept for compatibility)
            model: Optional model identifier (uses default if not provided)
            timeout: Timeout in seconds (default: 300)

        Returns:
            Video URL or None if generation failed
        """
        model_id = model or self.default_model

        # Build input parameters based on model type
        if "minimax" in model_id.lower():
            # MiniMax Video-01-Director parameters
            # Generates 6-second clips at high quality
            input_params = {
                "first_frame_image": image_url,
                "prompt": "smooth camera movement, high quality video, cinematic"
            }
        else:
            # Zeroscope v2 XL parameters
            # Calculate number of frames based on duration and fps
            num_frames = int(duration_seconds * fps)
            
            if settings.is_development():
                # Dev: Faster generation with fewer frames/steps
                num_frames = min(num_frames, 40)  # Cap at ~5 seconds for dev
                num_inference_steps = 20
            else:
                # Prod: Higher quality with more frames
                num_frames = min(num_frames, 80)  # Cap at ~10 seconds
                num_inference_steps = 50

            input_params = {
                "init_image": image_url,
                "num_frames": num_frames,
                "num_inference_steps": num_inference_steps,
                "guidance_scale": 17.5,
                "fps": fps,
                "width": 576,  # Zeroscope default width
                "height": 1024  # 9:16 aspect ratio
            }

        try:
            # Run the model asynchronously with timeout
            print(f"Generating video from image: {image_url[:50]}...")
            output = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.run,
                    model_id,
                    input=input_params
                ),
                timeout=timeout
            )

            # Handle output format (typically returns a video URL)
            if isinstance(output, str):
                print(f"✓ Video generated successfully")
                return output
            elif isinstance(output, list) and len(output) > 0:
                print(f"✓ Video generated successfully")
                return str(output[0])
            elif hasattr(output, 'url'):
                print(f"✓ Video generated successfully")
                return str(output.url)
            else:
                print(f"✗ Unexpected output format: {type(output)}")
                return None

        except asyncio.TimeoutError:
            print(f"✗ Video generation timed out after {timeout} seconds")
            return None
        except Exception as e:
            error_msg = str(e)
            print(f"✗ Video generation failed: {error_msg}")
            return None

    async def generate_videos_parallel(
        self,
        scenes: List[Dict[str, Any]],
        progress_callback: Optional[callable] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate videos for multiple scenes in parallel.

        Args:
            scenes: List of scene dictionaries with seed_image_url and other data
            progress_callback: Optional callback function(scene_number, status, video_url, error)

        Returns:
            List of dictionaries with video generation results
        """
        # Create tasks for parallel execution
        tasks = []
        for scene in scenes:
            task = self._generate_scene_video_safe(
                scene,
                progress_callback
            )
            tasks.append(task)

        # Execute all tasks in parallel
        print(f"\nStarting parallel generation of {len(scenes)} video clips...")
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count successful generations
        successful = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
        print(f"Completed video generation: {successful}/{len(results)} successful\n")

        return results

    def _categorize_error(self, error: Exception) -> tuple[str, bool]:
        """
        Categorize error and determine if it's retryable.

        Args:
            error: Exception that occurred

        Returns:
            Tuple of (error_category, is_retryable)
        """
        error_msg = str(error).lower()

        # Network/timeout errors - retryable
        if any(keyword in error_msg for keyword in ['timeout', 'connection', 'network', 'timed out']):
            return ("network_error", True)

        # Rate limit errors - retryable
        if any(keyword in error_msg for keyword in ['rate limit', 'too many requests', '429']):
            return ("rate_limit", True)

        # Server errors - retryable
        if any(keyword in error_msg for keyword in ['500', '502', '503', '504', 'server error']):
            return ("server_error", True)

        # Content policy violations - not retryable
        if any(keyword in error_msg for keyword in ['nsfw', 'inappropriate', 'policy', 'violation']):
            return ("content_policy", False)

        # Invalid input - not retryable
        if any(keyword in error_msg for keyword in ['invalid', 'bad request', '400']):
            return ("invalid_input", False)

        # Unknown error - not retryable by default
        return ("unknown_error", False)

    async def _generate_scene_video_with_retry(
        self,
        scene: Dict[str, Any],
        max_retries: int = 3,
        base_delay: float = 2.0
    ) -> Optional[str]:
        """
        Generate video with exponential backoff retry logic.

        Args:
            scene: Scene dictionary with seed_image_url, duration, etc.
            max_retries: Maximum number of retry attempts
            base_delay: Base delay in seconds for exponential backoff

        Returns:
            Video URL or None if all attempts failed
        """
        scene_number = scene.get("scene_number", 0)
        seed_image_url = scene.get("seed_image_url")
        duration = scene.get("duration", 4.0)

        last_error = None

        for attempt in range(max_retries + 1):
            try:
                print(f"Scene {scene_number}: Attempt {attempt + 1}/{max_retries + 1}")

                video_url = await self.generate_video_from_image(
                    image_url=seed_image_url,
                    duration_seconds=duration
                )

                if video_url:
                    if attempt > 0:
                        print(f"✓ Scene {scene_number}: Succeeded after {attempt} retries")
                    return video_url

                # No URL returned
                last_error = Exception("Video generation returned no output")

            except Exception as e:
                last_error = e
                error_category, is_retryable = self._categorize_error(e)

                print(f"✗ Scene {scene_number}: {error_category} - {str(e)}")

                # If not retryable or last attempt, fail immediately
                if not is_retryable or attempt == max_retries:
                    print(f"✗ Scene {scene_number}: Not retrying ({error_category})")
                    break

                # Calculate exponential backoff delay
                delay = base_delay * (2 ** attempt)
                print(f"⏳ Scene {scene_number}: Retrying in {delay:.1f}s...")
                await asyncio.sleep(delay)

        # All attempts failed
        error_msg = str(last_error) if last_error else "Unknown error"
        print(f"✗ Scene {scene_number}: Failed after {max_retries + 1} attempts: {error_msg}")
        return None

    async def _generate_scene_video_safe(
        self,
        scene: Dict[str, Any],
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Safely generate a video for a single scene with comprehensive error handling.

        Args:
            scene: Scene dictionary with seed_image_url, duration, scene_number, etc.
            progress_callback: Optional callback for progress updates

        Returns:
            Dictionary with generation results
        """
        scene_number = scene.get("scene_number", 0)
        duration = scene.get("duration", 4.0)

        try:
            # Notify processing started
            if progress_callback:
                await progress_callback(scene_number, "processing", None, None)

            # Generate video with retry logic
            video_url = await self._generate_scene_video_with_retry(scene, max_retries=2)

            if video_url:
                # Success
                if progress_callback:
                    await progress_callback(scene_number, "completed", video_url, None)

                return {
                    "success": True,
                    "scene_number": scene_number,
                    "video_url": video_url,
                    "duration": duration,
                    "error": None
                }
            else:
                # All retries failed
                error_msg = "Video generation failed after multiple attempts"
                if progress_callback:
                    await progress_callback(scene_number, "failed", None, error_msg)

                return {
                    "success": False,
                    "scene_number": scene_number,
                    "video_url": None,
                    "duration": duration,
                    "error": error_msg
                }

        except Exception as e:
            # Unexpected error in the wrapper itself
            error_msg = f"Unexpected error: {str(e)}"
            print(f"✗ Scene {scene_number}: {error_msg}")

            if progress_callback:
                await progress_callback(scene_number, "failed", None, error_msg)

            return {
                "success": False,
                "scene_number": scene_number,
                "video_url": None,
                "duration": duration,
                "error": error_msg
            }

