"""Replicate API service for image and video generation."""
import asyncio
from typing import List, Dict, Any, Optional
import replicate
import requests
import tempfile
import uuid
from pathlib import Path
from PIL import Image
import io
import base64
import shutil
import time
import logging
from app.config import settings
from app.services.rate_limiter import get_kontext_rate_limiter
from app.services.metrics_service import get_composite_metrics

logger = logging.getLogger(__name__)


class ReplicateImageService:
    """Service for generating images using Replicate API."""
    
    # Production model: SDXL (higher quality, more expensive, slower)
    # Quality: Excellent detail, great prompt following, professional results
    # Speed: ~30-60 seconds per 1920x1080 image
    # Verified model on Replicate
    PRODUCTION_IMAGE_MODEL = "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b"
    
    # Development model: Use SDXL with optimized settings (same model, faster params)
    # We use the same SDXL model but with:
    # - Lower resolution (1280x720 vs 1920x1080) = 4x faster
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
                timeout = 60  # Dev: SDXL at 1280x720 with 20 steps should finish in ~20-40s
            else:
                timeout = 90  # Prod: SDXL at 1920x1080 with 50 steps can take 30-60s
            
            return await self.generate_image(prompt, width, height, 1, model, timeout=timeout)
        except asyncio.TimeoutError:
            return None
        except Exception as e:
            # Log error but don't raise - let caller handle it
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
        components.append("Landscape 16:9 aspect ratio")
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
        # VALIDATION: Check for empty or invalid inputs
        if not scene_description or not scene_description.strip():
            scene_description = "Professional product photography scene"
        
        if not scene_style_prompt or not scene_style_prompt.strip():
            scene_style_prompt = "professional, cinematic"
        
        if not mood_aesthetic_direction or not mood_aesthetic_direction.strip():
            mood_aesthetic_direction = "modern, professional"

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
        components.append("Landscape 16:9 aspect ratio")
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
        width: int = 1920,
        height: int = 1080
    ) -> List[Dict[str, Any]]:
        """
        Generate seed images for multiple scenes in parallel.

        Args:
            scenes: List of scene dictionaries with description and style_prompt
            mood_style_keywords: Style keywords from selected mood
            mood_color_palette: Color palette from selected mood
            mood_aesthetic_direction: Aesthetic direction from selected mood
            width: Image width (default: 1920 for prod quality - 16:9 landscape)
            height: Image height (default: 1080 for 16:9 landscape)

        Returns:
            List of dictionaries with scene data and generated image URLs
        """
        # VALIDATION: Check inputs before processing
        if not scenes:
            raise ValueError("No scenes provided for seed image generation")
        
        # Validate each scene before building prompts
        for idx, scene in enumerate(scenes):
            scene_num = scene.get("scene_number", idx + 1)
            description = scene.get("description", "")
            style_prompt = scene.get("style_prompt", "")
            
            if not description or not description.strip():
                raise ValueError(f"Scene {scene_num} has empty description")
            if not style_prompt or not style_prompt.strip():
                raise ValueError(f"Scene {scene_num} has empty style_prompt")
        
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
        image_results = await self.generate_images_parallel(
            prompts=prompts,
            width=width,
            height=height
        )

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
    
    async def generate_scene_with_product(
        self,
        scene_text: str,
        style_prompt: str,
        product_image_path: str,
        width: int = 1920,
        height: int = 1080
    ) -> str:
        """
        Generate scene image with product composited in.
        
        MVP Implementation:
        Uses two-stage approach:
        1. Generate scene background
        2. Composite product using PIL
        
        This gives maximum control over final result.
        
        Args:
            scene_text: Scene description
            style_prompt: Style/mood prompt
            product_image_path: Path to product image file
            width: Target width (default 1920 for 16:9 landscape)
            height: Target height (default 1080 for 16:9 landscape)
        
        Returns:
            URL to generated composited image
        """
        print(f"[Product Composite] Generating scene with product")
        
        # Stage 1: Generate scene background using nano-banana-pro
        # Add "empty space in center" to prompt to leave room for product
        bg_prompt = f"{scene_text}. {style_prompt}. empty space in center for product placement. elegant composition. landscape orientation, horizontal composition."
        
        print(f"[Product Composite] Generating background scene with nano-banana-pro...")
        
        # Use nano-banana-pro for 16:9 landscape generation
        input_params = {
            "prompt": bg_prompt,
            "resolution": "1K",  # 1920x1080 = 1K resolution
            "aspect_ratio": "16:9",  # Landscape orientation
            "image_input": [],  # No control images for background
            "output_format": "png",
            "safety_filter_level": "block_only_high"
        }
        
        output = await asyncio.to_thread(
            self.client.run,
            "google/nano-banana-pro",
            input=input_params
        )
        
        # Extract image URL from nano-banana-pro output
        if not output:
            raise Exception("No output from nano-banana-pro for background")
        
        if isinstance(output, list) and len(output) > 0:
            bg_image_url = str(output[0])
        elif isinstance(output, str):
            bg_image_url = output
        elif hasattr(output, 'url'):
            bg_image_url = output.url
        elif hasattr(output, '__str__'):
            bg_image_url = str(output)
        else:
            raise Exception(f"Unexpected output format from nano-banana-pro: {type(output)}")
        
        # Stage 2: Composite product onto scene
        print(f"[Product Composite] Compositing product onto scene...")
        
        # Download background image
        bg_response = requests.get(bg_image_url)
        bg_image = Image.open(io.BytesIO(bg_response.content))
        
        # Load product image
        product_image = Image.open(product_image_path)
        
        # Composite product onto center
        composited = self._composite_product_centered(
            background=bg_image,
            product=product_image,
            max_product_width_percent=50,
            max_product_height_percent=60
        )
        
        # Save composited image to temp file
        temp_dir = Path(tempfile.gettempdir()) / "product_composites"
        temp_dir.mkdir(exist_ok=True)
        
        composite_filename = f"composite_{uuid.uuid4()}.png"
        composite_path = temp_dir / composite_filename
        
        composited.save(composite_path, 'PNG')
        
        # Move to uploads directory for serving
        uploads_dir = Path("uploads/composites")
        uploads_dir.mkdir(parents=True, exist_ok=True)
        
        final_path = uploads_dir / composite_filename
        composited.save(final_path, 'PNG')
        
        # Return URL (assumes FastAPI serves /uploads/ statically)
        return f"/uploads/composites/{composite_filename}"
    
    def _composite_product_centered(
        self,
        background: Image.Image,
        product: Image.Image,
        max_product_width_percent: int = 50,
        max_product_height_percent: int = 60
    ) -> Image.Image:
        """
        Composite product image onto center of background.
        
        Algorithm Specifications:
        1. Calculate max dimensions:
           - max_width = bg_width * (50/100) = bg_width * 0.5
           - max_height = bg_height * (60/100) = bg_height * 0.6
        
        2. Calculate scale factor (never upscale):
           - width_scale = max_width / prod_width
           - height_scale = max_height / prod_height
           - scale_factor = min(width_scale, height_scale, 1.0)
        
        3. Calculate new dimensions:
           - new_width = int(prod_width * scale_factor)
           - new_height = int(prod_height * scale_factor)
        
        4. Resize with LANCZOS (highest quality)
        
        5. Calculate center position:
           - x = (bg_width - new_width) // 2  (integer division)
           - y = (bg_height - new_height) // 2
        
        6. Alpha composite:
           - If RGBA: Use alpha channel as mask
           - If RGB: Direct paste
        
        Args:
            background: Background scene image (e.g., 1920x1080)
            product: Product image (any size, any format)
            max_product_width_percent: Max width as % of bg (default 50)
            max_product_height_percent: Max height as % of bg (default 60)
        
        Returns:
            Composited image (same size as background)
        
        Example:
            Background: 1920x1080
            Product: 2048x2048
            Max dimensions: 960x648
            Scale factor: min(960/2048, 648/2048, 1.0) = 0.316
            New size: 648x648
            Position: x=636, y=216 (centered)
        """
        bg_width, bg_height = background.size
        prod_width, prod_height = product.size
        
        # Calculate max product dimensions (integer pixels)
        max_prod_width = int(bg_width * max_product_width_percent / 100)
        max_prod_height = int(bg_height * max_product_height_percent / 100)
        
        # Scale product to fit within max dimensions (maintain aspect ratio)
        # CRITICAL: Do not upscale (cap at 1.0)
        width_scale = max_prod_width / prod_width
        height_scale = max_prod_height / prod_height
        scale_factor = min(width_scale, height_scale, 1.0)
        
        # Calculate new dimensions (integer pixels)
        new_prod_width = int(prod_width * scale_factor)
        new_prod_height = int(prod_height * scale_factor)
        
        # Resize product using LANCZOS (highest quality resampling)
        product_resized = product.resize(
            (new_prod_width, new_prod_height),
            Image.Resampling.LANCZOS
        )
        
        # Calculate exact center position (integer division)
        x = (bg_width - new_prod_width) // 2
        y = (bg_height - new_prod_height) // 2
        
        # Create composite (copy background to avoid modifying original)
        result = background.copy()
        
        # Ensure background is RGB or RGBA
        if result.mode not in ['RGB', 'RGBA']:
            result = result.convert('RGB')
        
        # Composite based on product mode
        if product_resized.mode == 'RGBA':
            # Use alpha channel for transparency
            result.paste(product_resized, (x, y), product_resized)
        elif product_resized.mode == 'RGB':
            # Direct paste (no transparency)
            result.paste(product_resized, (x, y))
        else:
            # Convert other modes to RGB first
            product_rgb = product_resized.convert('RGB')
            result.paste(product_rgb, (x, y))
        
        return result
    
    async def _image_to_base64(self, image_path: str) -> str:
        """
        Convert image file to base64 string.
        
        Args:
            image_path: Path to image file
        
        Returns:
            Base64 encoded string
            
        Raises:
            Exception: If file too large (>10MB) or invalid
        """
        path = Path(image_path)
        
        # Check file size
        file_size = path.stat().st_size
        max_size = 10 * 1024 * 1024  # 10MB
        
        if file_size > max_size:
            raise Exception(f"Image too large: {file_size} bytes (max {max_size})")
        
        # Check if compression needed (5-10MB)
        if file_size > 5 * 1024 * 1024:
            print(f"[Image Encoding] Compressing large image: {file_size} bytes")
            image = Image.open(image_path)
            
            # Compress to temporary file
            temp_path = Path(tempfile.gettempdir()) / f"compressed_{uuid.uuid4()}.png"
            image.save(temp_path, 'PNG', optimize=True, quality=85)
            
            # Read compressed file
            with open(temp_path, 'rb') as f:
                image_data = f.read()
            
            # Clean up temp file
            temp_path.unlink()
        else:
            # Read file directly
            with open(image_path, 'rb') as f:
                image_data = f.read()
        
        # Encode to base64
        encoded = base64.b64encode(image_data).decode('utf-8')
        print(f"[Image Encoding] Encoded {len(image_data)} bytes to {len(encoded)} base64 chars")
        
        return encoded
    
    async def _upload_temp_image(self, image_path: str) -> str:
        """
        Upload image to temporary storage and return public URL.
        
        Fallback method when base64 encoding fails or isn't supported.
        
        Args:
            image_path: Path to image file
        
        Returns:
            Publicly accessible URL to image
        """
        # Create temp uploads directory
        temp_dir = Path("uploads/temp")
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        filename = f"temp_{uuid.uuid4()}{Path(image_path).suffix}"
        temp_path = temp_dir / filename
        
        # Copy file to temp location
        shutil.copy2(image_path, temp_path)
        
        # Schedule cleanup (1 hour)
        # Note: In production, use a task queue or cron job
        asyncio.create_task(self._cleanup_temp_file(temp_path, delay=3600))
        
        # Return URL (assumes FastAPI serves /uploads/)
        url = f"/uploads/temp/{filename}"
        print(f"[Image Upload] Uploaded to temp storage: {url}")
        
        return url
    
    async def _cleanup_temp_file(self, file_path: Path, delay: int = 3600):
        """
        Delete temporary file after delay.
        
        Args:
            file_path: Path to file to delete
            delay: Delay in seconds before deletion (default 1 hour)
        """
        await asyncio.sleep(delay)
        
        try:
            if file_path.exists():
                file_path.unlink()
                print(f"[Cleanup] Deleted temp file: {file_path}")
        except Exception as e:
            print(f"[Cleanup] Failed to delete temp file {file_path}: {e}")
    
    async def generate_scene_with_kontext_composite(
        self,
        scene_text: str,
        style_prompt: str,
        product_image_path: str,
        width: int = 1920,
        height: int = 1080
    ) -> str:
        """
        Generate scene with product using FLUX Kontext multi-image.
        
        Three-stage approach:
        1. Generate base scene background
        2. Prepare product image (base64 or URL)
        3. Use FLUX Kontext to intelligently composite
        
        Args:
            scene_text: Scene description
            style_prompt: Style/mood prompt
            product_image_path: Path to product image file
            width: Target width
            height: Target height
        
        Returns:
            URL to composited image
            
        Raises:
            Exception: If generation fails at any stage
        """
        print(f"[Kontext Composite] Starting scene generation with Kontext")
        
        metrics = get_composite_metrics()
        start_time = time.time()
        
        try:
            # Acquire rate limit slot
            rate_limiter = get_kontext_rate_limiter()
            async with rate_limiter:
                # Stage 1: Generate base scene background using nano-banana-pro
                # Use full prompt with landscape orientation
                bg_prompt = f"{scene_text}. {style_prompt}. landscape orientation, horizontal composition."
                
                print(f"[Kontext Composite] Generating base scene with nano-banana-pro...")
                
                # Use nano-banana-pro for 16:9 landscape generation
                input_params = {
                    "prompt": bg_prompt,
                    "resolution": "1K",  # 1920x1080 = 1K resolution
                    "aspect_ratio": "16:9",  # Landscape orientation
                    "image_input": [],  # No control images for background
                    "output_format": "png",
                    "safety_filter_level": "block_only_high"
                }
                
                output = await asyncio.to_thread(
                    self.client.run,
                    "google/nano-banana-pro",
                    input=input_params
                )
                
                # Extract image URL from nano-banana-pro output
                if not output:
                    raise Exception("No output from nano-banana-pro for base scene")
                
                if isinstance(output, list) and len(output) > 0:
                    base_scene_url = str(output[0])
                elif isinstance(output, str):
                    base_scene_url = output
                elif hasattr(output, 'url'):
                    base_scene_url = output.url
                elif hasattr(output, '__str__'):
                    base_scene_url = str(output)
                else:
                    raise Exception(f"Unexpected output format from nano-banana-pro: {type(output)}")
                print(f"[Kontext Composite] Base scene generated: {base_scene_url}")
                
                # Stage 2: Prepare product image
                print(f"[Kontext Composite] Preparing product image...")
                
                # Try base64 encoding first
                try:
                    product_data = await self._image_to_base64(product_image_path)
                    product_input = f"data:image/png;base64,{product_data}"
                    print(f"[Kontext Composite] Product encoded as base64")
                except Exception as e:
                    print(f"[Kontext Composite] Base64 encoding failed: {e}, using URL fallback")
                    # Fallback: Upload to temp storage and get URL
                    product_input = await self._upload_temp_image(product_image_path)
                
                # Stage 3: Composite with FLUX Kontext
                print(f"[Kontext Composite] Compositing product into scene...")
                
                composite_prompt = f"""Seamlessly integrate the product from image 2 into the scene from image 1.
Place the product naturally with matching perspective, lighting, and shadows.
Scene: {scene_text}
Style: {style_prompt}
Ensure the product appears as part of the original scene."""
                
                output = await asyncio.to_thread(
                    self.client.run,
                    settings.KONTEXT_MODEL_ID,
                    input={
                        "image_1": base_scene_url,
                        "image_2": product_input,
                        "prompt": composite_prompt,
                        "output_format": "png",
                        "output_quality": 90,
                    }
                )
                
                if not output or len(output) == 0:
                    raise Exception("No output from FLUX Kontext")
                
                composite_url = str(output[0]) if hasattr(output[0], '__str__') else output[0]
                print(f"[Kontext Composite] Composite generated: {composite_url}")
            
            # Stage 4: Download and save composite
            print(f"[Kontext Composite] Saving composite image...")
            
            response = requests.get(composite_url)
            if response.status_code != 200:
                raise Exception(f"Failed to download composite: {response.status_code}")
            
            composite_image = Image.open(io.BytesIO(response.content))
            
            # Save to uploads directory
            uploads_dir = Path("uploads/composites")
            uploads_dir.mkdir(parents=True, exist_ok=True)
            
            composite_filename = f"kontext_{uuid.uuid4()}.png"
            final_path = uploads_dir / composite_filename
            
            composite_image.save(final_path, 'PNG')
            
            # Return URL
            final_url = f"/uploads/composites/{composite_filename}"
            print(f"[Kontext Composite] Composite saved: {final_url}")
            
            # Record success
            duration = time.time() - start_time
            metrics.record_kontext_call(success=True, duration_seconds=duration)
            
            # Check generation alert
            metrics.check_daily_generation_alert(threshold=settings.KONTEXT_DAILY_GENERATION_LIMIT)
            
            return final_url
            
        except Exception as e:
            # Record failure
            duration = time.time() - start_time
            metrics.record_kontext_call(success=False, duration_seconds=duration)
            raise

    async def generate_scene_with_assets(
        self,
        scene_text: str,
        style_prompt: str,
        brand_asset_image_url: Optional[str] = None,
        character_asset_image_url: Optional[str] = None,
        background_asset_image_url: Optional[str] = None,
        brand_asset_filename: Optional[str] = None,
        character_asset_filename: Optional[str] = None,
        background_asset_filename: Optional[str] = None,
        width: int = 1920,
        height: int = 1080
    ) -> str:
        """
        Generate scene image using google/nano-banana-pro with brand, character, and background assets as control images.
        
        This creates the starting image (first frame) for the scene with assets naturally integrated.
        Uses 16:9 aspect ratio (1920x1080), PNG format, and landscape orientation.
        
        Args:
            scene_text: Scene description
            style_prompt: Style/mood prompt
            brand_asset_image_url: URL to brand asset image (for control image)
            character_asset_image_url: URL to character asset image (for control image)
            background_asset_image_url: URL to background asset image (for control image)
            brand_asset_filename: Filename of brand asset (for prompt description)
            character_asset_filename: Filename of character asset (for prompt description)
            background_asset_filename: Filename of background asset (for prompt description)
            width: Target width (default 1920 for 16:9)
            height: Target height (default 1080 for 16:9)
        
        Returns:
            URL to generated image
        """
        logger.info("="*80)
        logger.info("🍌 GENERATING SCENE WITH ASSETS USING google/nano-banana-pro")
        logger.info("="*80)
        
        # Build prompt that merges scene text, asset descriptions, style, and starting frame context
        # Specify landscape orientation explicitly
        prompt_parts = [scene_text]
        
        # Add landscape orientation specification
        prompt_parts.append("landscape orientation, horizontal composition")
        
        # Add asset descriptions naturally
        if brand_asset_filename:
            prompt_parts.append(f"featuring brand elements from {brand_asset_filename}")
        if character_asset_filename:
            prompt_parts.append(f"with character from {character_asset_filename}")
        if background_asset_filename:
            prompt_parts.append(f"set against background from {background_asset_filename}")
        
        # Add style
        if style_prompt:
            prompt_parts.append(style_prompt)
        
        # Add starting frame context
        prompt_parts.append("This is the starting frame of the scene, establishing the visual composition before action begins.")
        
        # Merge all parts naturally
        full_prompt = ". ".join(prompt_parts)
        
        # Log the Scene Description
        logger.info("📝 SCENE DESCRIPTION:")
        logger.info(f"  Scene Text: {scene_text}")
        logger.info(f"  Style Prompt: {style_prompt}")
        
        # Log the full prompt being sent
        logger.info("📝 PROMPT BEING SENT TO google/nano-banana-pro:")
        logger.info("-"*80)
        logger.info(full_prompt)
        logger.info("-"*80)
        
        # Collect control images and convert localhost URLs to base64
        # Replicate cannot access localhost URLs, so we need to convert them to base64 data URIs
        control_images = []
        
        async def ensure_public_url(image_url: Optional[str], asset_type: str) -> Optional[str]:
            """Convert localhost URLs to base64 data URIs for Replicate compatibility."""
            if not image_url:
                return None
            
            # If it's already a public URL (starts with http:// or https:// and not localhost), use it as-is
            if image_url.startswith(("http://", "https://")) and "localhost" not in image_url and "127.0.0.1" not in image_url:
                return image_url
            
            # If it's a localhost URL, convert to base64
            if "localhost" in image_url or "127.0.0.1" in image_url:
                logger.info(f"🔄 Converting {asset_type} localhost URL to base64 for Replicate compatibility")
                try:
                    # Fetch the image from localhost
                    response = requests.get(image_url, timeout=10)
                    if response.status_code == 200:
                        # Determine content type from response headers
                        content_type = response.headers.get('content-type', 'image/png')
                        # Convert to base64 data URI
                        base64_data = base64.b64encode(response.content).decode('utf-8')
                        data_uri = f"data:{content_type};base64,{base64_data}"
                        logger.info(f"✓ Converted {asset_type} to base64 data URI ({len(base64_data)} chars)")
                        return data_uri
                    else:
                        logger.warning(f"⚠️  Failed to fetch {asset_type} from {image_url}: HTTP {response.status_code}")
                        return None
                except Exception as e:
                    logger.error(f"❌ Error converting {asset_type} URL to base64: {e}")
                    return None
            
            # If it's a relative path, convert to full URL first, then check if localhost
            if not image_url.startswith(("http://", "https://")):
                full_url = settings.to_full_url(image_url)
                return await ensure_public_url(full_url, asset_type)
            
            return image_url
        
        # Convert all control image URLs to public URLs or base64
        # nano-banana-pro supports up to 14 images according to documentation
        if brand_asset_image_url:
            converted_brand_url = await ensure_public_url(brand_asset_image_url, "brand asset")
            if converted_brand_url:
                control_images.append(converted_brand_url)
            else:
                logger.warning("⚠️  Brand asset URL could not be converted, skipping")
        
        if character_asset_image_url:
            converted_character_url = await ensure_public_url(character_asset_image_url, "character asset")
            if converted_character_url:
                control_images.append(converted_character_url)
            else:
                logger.warning("⚠️  Character asset URL could not be converted, skipping")
        
        if background_asset_image_url:
            converted_background_url = await ensure_public_url(background_asset_image_url, "background asset")
            if converted_background_url:
                control_images.append(converted_background_url)
            else:
                logger.warning("⚠️  Background asset URL could not be converted, skipping")
        
        # Log control image URLs
        logger.info("🖼️  CONTROL IMAGE URLS BEING SENT:")
        if control_images:
            for i, img_url in enumerate(control_images, 1):
                # Truncate base64 data URIs in logs for readability
                display_url = img_url[:100] + "..." if len(img_url) > 100 and img_url.startswith("data:") else img_url
                logger.info(f"  Image {i}: {display_url}")
        else:
            logger.info("  (No control images)")
        
        # Prepare input for nano-banana-pro according to API documentation
        # API expects: prompt, resolution, image_input (array), aspect_ratio, output_format, safety_filter_level
        # Resolution options: "1K", "2K", "4K" (we're using 1920x1080 which is 1K)
        # Aspect ratio: "16:9" for landscape (1920x1080)
        input_params = {
            "prompt": full_prompt,
            "resolution": "1K",  # 1920x1080 = 1K resolution
            "aspect_ratio": "16:9",  # Landscape orientation
            "image_input": control_images,  # Array of image URLs for control/reference images
            "output_format": "png",
            "safety_filter_level": "block_only_high"  # Optional safety filter
        }
        
        logger.info(f"  → Using 'image_input' parameter with {len(control_images)} image(s)")
        
        # Log all input parameters
        logger.info("📦 ALL PARAMETERS BEING SENT TO google/nano-banana-pro:")
        logger.info("-"*80)
        logger.info(f"  Model: google/nano-banana-pro")
        logger.info(f"  Prompt: {full_prompt}")
        logger.info(f"  Resolution: {input_params['resolution']}")
        logger.info(f"  Aspect Ratio: {input_params['aspect_ratio']}")
        logger.info(f"  Output Format: {input_params['output_format']}")
        logger.info(f"  Safety Filter Level: {input_params['safety_filter_level']}")
        if input_params['image_input']:
            logger.info(f"  Image Input: {len(input_params['image_input'])} image(s)")
            for i, img in enumerate(input_params['image_input'], 1):
                logger.info(f"    [{i}] {img}")
        else:
            logger.info(f"  Image Input: (empty array)")
        logger.info("-"*80)
        
        # Log the COMPLETE JSON object being sent to the API
        import json
        logger.info("\n" + "="*80)
        logger.info("🔍 COMPLETE JSON OBJECT BEING SENT TO google/nano-banana-pro:")
        logger.info("="*80)
        try:
            json_payload = json.dumps(input_params, indent=2, ensure_ascii=False)
            logger.info(json_payload)
        except Exception as e:
            logger.error(f"Failed to serialize JSON: {e}")
            logger.info(f"Input params dict: {input_params}")
        logger.info("="*80 + "\n")
        
        logger.info("🚀 Calling Replicate API with model: google/nano-banana-pro")
        start_time = asyncio.get_event_loop().time()
        
        # Retry logic for transient Replicate API errors
        max_retries = 3
        base_delay = 2.0
        output = None
        
        for attempt in range(max_retries):
            try:
                # Call nano-banana-pro
                output = await asyncio.to_thread(
                    self.client.run,
                    "google/nano-banana-pro",
                    input=input_params
                )
                
                elapsed_time = asyncio.get_event_loop().time() - start_time
                logger.info(f"⏱️  API call completed in {elapsed_time:.2f}s")
                
                logger.info("📤 RAW OUTPUT FROM google/nano-banana-pro:")
                logger.info(f"  Type: {type(output)}")
                logger.info(f"  Value: {output}")
                
                # Check if output indicates an error
                if output is None:
                    raise Exception("No output from nano-banana-pro")
                
                # Check for error in output (Replicate sometimes returns error dicts)
                if isinstance(output, dict):
                    if "error" in output:
                        error_msg = output.get("error", "Unknown error")
                        raise Exception(f"Replicate API error: {error_msg}")
                    if "status" in output and output.get("status") == "failed":
                        error_msg = output.get("error", "Generation failed")
                        raise Exception(f"Replicate generation failed: {error_msg}")
                
                # Extract image URL from output
                if isinstance(output, list) and len(output) > 0:
                    image_url = str(output[0])
                elif isinstance(output, str):
                    image_url = output
                elif hasattr(output, 'url'):
                    image_url = output.url
                elif hasattr(output, '__str__'):
                    image_url = str(output)
                else:
                    raise Exception(f"Unexpected output format from nano-banana-pro: {type(output)}")
                
                logger.info("✅ RESULTING IMAGE URL FROM google/nano-banana-pro:")
                logger.info(f"  {image_url}")
                logger.info("="*80)
                
                return image_url
                
            except Exception as e:
                error_msg = str(e).lower()
                elapsed_time = asyncio.get_event_loop().time() - start_time
                
                # Check if this is a retryable error
                is_retryable = (
                    "e6716" in error_msg or  # Director error - often transient
                    "director" in error_msg or
                    "unexpected error" in error_msg or
                    "timeout" in error_msg or
                    "rate limit" in error_msg or
                    "429" in error_msg or
                    "500" in error_msg or
                    "502" in error_msg or
                    "503" in error_msg
                )
                
                if attempt < max_retries - 1 and is_retryable:
                    delay = base_delay * (2 ** attempt)  # Exponential backoff: 2s, 4s, 8s
                    logger.warning(f"⚠️  Attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                    logger.warning(f"   Retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    # Last attempt or non-retryable error - log and raise
                    logger.error(f"❌ ERROR calling nano-banana-pro after {elapsed_time:.2f}s:")
                    logger.error(f"  Error type: {type(e).__name__}")
                    logger.error(f"  Error message: {str(e)}")
                    logger.error(f"  Input params: {json.dumps(input_params, indent=2)}")
                    logger.error("="*80)
                    raise
        
        # This should never be reached, but added for completeness
        raise Exception("Failed to generate image after all retry attempts")


class ReplicateVideoService:
    """Service for generating videos using Replicate API img2vid models."""

    # Production model: ByteDance Seedance 1 Pro Fast (high quality, supports prompts)
    # Fast, high-quality video generation with prompt support for scene descriptions
    PRODUCTION_VIDEO_MODEL = "google/veo-3.1"

    # Development model: Same as production (Seedance supports prompts)
    # Using Seedance in both dev and prod because it supports prompts
    # This ensures scene descriptions are actually used in video generation
    DEVELOPMENT_VIDEO_MODEL = "google/veo-3.1"

    def __init__(self):
        """Initialize the Replicate video service with API token."""
        token = settings.get_replicate_token()
        if not token:
            raise ValueError("Replicate API token not configured. Set REPLICATE_API_TOKEN in environment.")

        # Set the token for replicate client
        self.client = replicate.Client(api_token=token)

        # Determine which model to use based on environment
        # Using Seedance in both dev and prod because it supports prompts
        # Zeroscope doesn't accept prompts, so scene descriptions would be ignored
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
        timeout: int = 300,  # 5 minute timeout for video generation
        prompt: Optional[str] = None  # Optional prompt describing the scene (for Seedance/MiniMax models)
    ) -> Optional[str]:
        """
        Generate a video from a seed image using Replicate's img2vid model.

        Args:
            image_url: URL of the seed image (can be relative path or full URL)
            duration_seconds: Target duration in seconds (2-12 seconds for Seedance, 3-8 for others)
            fps: Frames per second (default: 8, unused for Seedance/MiniMax)
            motion_bucket_id: Amount of motion (unused, kept for compatibility)
            cond_aug: Conditioning augmentation (unused, kept for compatibility)
            model: Optional model identifier (uses default if not provided)
            timeout: Timeout in seconds (default: 300)
            prompt: Optional prompt describing the scene (used by Seedance and MiniMax, ignored by Zeroscope)

        Returns:
            Video URL or None if generation failed
        """
        model_id = model or self.default_model
        
        # Convert relative image URL to full URL for Replicate API
        # Replicate requires a proper URI format (http:// or https://)
        full_image_url = settings.to_full_url(image_url)
        
        # For localhost URLs, convert to base64 data URI since Replicate can't access localhost
        # This is necessary for local development with composites
        if "localhost" in full_image_url or "127.0.0.1" in full_image_url:
            # Extract the local file path from the URL
            # e.g., http://localhost:8000/uploads/composites/file.png -> uploads/composites/file.png
            local_path = full_image_url.split("/uploads/", 1)[-1]
            local_file_path = f"uploads/{local_path}"
            
            # Check if file exists locally
            from pathlib import Path
            if Path(local_file_path).exists():
                try:
                    # Convert to base64 data URI
                    base64_data = await self._image_to_base64(local_file_path)
                    full_image_url = f"data:image/png;base64,{base64_data}"
                    print(f"[Video Generation] Converted localhost URL to base64 data URI for Replicate")
                except Exception as e:
                    print(f"[Video Generation] Failed to convert to base64: {e}, will try URL anyway")

        # Build input parameters based on model type
        if "seedance" in model_id.lower():
            # ByteDance Seedance 1 Pro Fast parameters
            # Use scene description if provided, otherwise use generic prompt
            video_prompt = prompt or "smooth camera movement, high quality video, cinematic"
            
            # Seedance supports image-to-video with prompts
            # Required parameters: image, prompt
            # Optional parameters: duration (3-8s), resolution (480p/720p/1080p), aspect_ratio (16:9 for landscape)
            # Clamp duration to valid range (3-8 seconds)
            clamped_duration = min(max(int(duration_seconds), 3), 8)
            
            # Set resolution based on environment
            if settings.is_development():
                resolution = "720p"  # Faster for dev
            else:
                resolution = "1080p"  # Higher quality for prod
            
            input_params = {
                "image": full_image_url,
                "prompt": video_prompt,  # Use scene description
                "duration": clamped_duration,  # Seedance supports 3-8 seconds
                "resolution": resolution,  # 480p, 720p, or 1080p
                "aspect_ratio": "16:9"  # Landscape format (1080p)
            }
        elif "minimax" in model_id.lower():
            # MiniMax Video-01-Director parameters
            # Use scene description if provided, otherwise use generic prompt
            video_prompt = prompt or "smooth camera movement, high quality video, cinematic"
            
            input_params = {
                "first_frame_image": full_image_url,
                "prompt": video_prompt  # Use scene description instead of hard-coded prompt
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
                "init_image": full_image_url,
                "num_frames": num_frames,
                "num_inference_steps": num_inference_steps,
                "guidance_scale": 17.5,
                "fps": fps,
                "width": 1920,  # 16:9 aspect ratio (1080p)
                "height": 1080  # 16:9 aspect ratio (1080p)
            }

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

            # Handle output format (typically returns a video URL)
            if isinstance(output, str):
                return output
            elif isinstance(output, list) and len(output) > 0:
                return str(output[0])
            elif hasattr(output, 'url'):
                return str(output.url)
            else:
                return None

        except asyncio.TimeoutError:
            return None
        except Exception as e:
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
            scene: Scene dictionary with seed_image_url, duration, description, etc.
            max_retries: Maximum number of retry attempts
            base_delay: Base delay in seconds for exponential backoff

        Returns:
            Video URL or None if all attempts failed
        """
        scene_number = scene.get("scene_number", 0)
        seed_image_url = scene.get("seed_image_url")
        duration = scene.get("duration", 4.0)
        scene_description = scene.get("description", "")  # Get scene description for prompt

        last_error = None

        for attempt in range(max_retries + 1):
            try:
                video_url = await self.generate_video_from_image(
                    image_url=seed_image_url,
                    duration_seconds=duration,
                    prompt=scene_description  # Pass scene description as prompt
                )

                if video_url:
                    return video_url

                # No URL returned
                last_error = Exception("Video generation returned no output")

            except Exception as e:
                last_error = e
                error_category, is_retryable = self._categorize_error(e)

                # If not retryable or last attempt, fail immediately
                if not is_retryable or attempt == max_retries:
                    break

                # Calculate exponential backoff delay
                delay = base_delay * (2 ** attempt)
                await asyncio.sleep(delay)

        # All attempts failed
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


# Singleton instances
_replicate_image_service: Optional[ReplicateImageService] = None
_replicate_video_service: Optional[ReplicateVideoService] = None

def get_replicate_service() -> ReplicateImageService:
    """Get or create replicate image service singleton."""
    global _replicate_image_service
    if _replicate_image_service is None:
        _replicate_image_service = ReplicateImageService()
    return _replicate_image_service

def get_replicate_video_service() -> ReplicateVideoService:
    """Get or create replicate video service singleton."""
    global _replicate_video_service
    if _replicate_video_service is None:
        _replicate_video_service = ReplicateVideoService()
    return _replicate_video_service

