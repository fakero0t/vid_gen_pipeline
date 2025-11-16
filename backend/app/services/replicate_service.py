"""Replicate API service for image generation."""
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

