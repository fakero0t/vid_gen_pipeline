"""
Background Asset Service

Handles background image generation from creative briefs and asset management.
"""

import asyncio
import uuid
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from openai import OpenAI
import requests
from PIL import Image
import io

from ..models.background_models import BackgroundAssetStatus, BackgroundGenerationRequest
from ..models.asset_models import ImageDimensions
from .base_asset_service import BaseAssetService
from .replicate_service import ReplicateImageService
from ..config import settings

logger = logging.getLogger(__name__)


class BackgroundAssetService(BaseAssetService):
    """Service for managing background assets."""
    
    def __init__(self, upload_dir: Path = Path("uploads/backgrounds")):
        from ..models.background_models import BackgroundAssetUploadResponse
        super().__init__(
            upload_dir=upload_dir,
            api_prefix="background",
            response_class=BackgroundAssetUploadResponse,
            status_class=BackgroundAssetStatus
        )
        # Initialize replicate service only if token is available
        # Don't initialize here - will be checked in generate_backgrounds_from_brief
        self.replicate_service = None
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
    
    async def generate_backgrounds_from_brief(
        self,
        brief: BackgroundGenerationRequest
    ) -> List[BackgroundAssetStatus]:
        """
        Generate 6 background images from creative brief using google/nano-banana-pro.
        
        Steps:
        1. Generate 6 distinct background prompts using AI
        2. Generate 6 images in parallel using google/nano-banana-pro
        3. Save each image as a background asset
        4. Return list of background asset statuses
        
        Args:
            brief: Creative brief containing product info, audience, etc.
        
        Returns:
            List of 6 BackgroundAssetStatus objects
        """
        # Initialize replicate service if not already initialized
        if not self.replicate_service:
            if not settings.get_replicate_token():
                raise ValueError("Replicate API token not configured")
            self.replicate_service = ReplicateImageService()
        
        # Step 1: Generate 6 distinct background prompts
        logger.info("Generating 6 distinct background prompts from creative brief...")
        prompts = await self._generate_background_prompts(brief)
        
        if len(prompts) != 6:
            raise ValueError(f"Expected 6 prompts, got {len(prompts)}")
        
        # Step 2: Generate 6 images in parallel using google/nano-banana-pro
        logger.info("Generating 6 background images in parallel...")
        image_urls = await self._generate_images_parallel(prompts)
        
        # Step 3: Save each image as a background asset
        logger.info("Saving generated images as background assets...")
        background_assets = []
        
        for idx, (prompt, image_url) in enumerate(zip(prompts, image_urls)):
            if not image_url:
                logger.warning(f"Image {idx + 1} generation failed, skipping...")
                continue
            
            try:
                # Download the image
                response = requests.get(image_url, timeout=30)
                response.raise_for_status()
                image_data = response.content
                
                # Save as asset
                filename = f"background-{idx + 1}.png"
                asset_response = self.save_asset(image_data, filename)
                
                # Convert to status
                asset_status = self.get_asset(asset_response.asset_id)
                if asset_status:
                    background_assets.append(asset_status)
                    logger.info(f"Saved background {idx + 1} as asset {asset_response.asset_id}")
                else:
                    logger.error(f"Failed to retrieve asset status for {asset_response.asset_id}")
                    
            except Exception as e:
                logger.error(f"Failed to save background {idx + 1}: {str(e)}")
                continue
        
        if len(background_assets) == 0:
            raise RuntimeError("Failed to generate any background images")
        
        logger.info(f"Successfully generated {len(background_assets)} background assets")
        return background_assets
    
    async def _generate_background_prompts(
        self,
        brief: BackgroundGenerationRequest
    ) -> List[str]:
        """Generate 6 distinct background prompts from creative brief using AI."""
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")
        
        # Build prompt for background generation
        prompt = self._build_background_prompt_generation_prompt(brief)
        
        # Call OpenAI to generate background prompts
        response = await self._generate_prompts_with_openai(prompt)
        
        # Parse and validate the response
        prompts = self._parse_prompt_response(response)
        
        # Ensure we have exactly 6 prompts
        if len(prompts) < 6:
            # Generate fallback prompts if needed
            while len(prompts) < 6:
                idx = len(prompts)
                prompts.append(f"Background scene {idx + 1} for {brief.product_name}")
        
        return prompts[:6]
    
    def _build_background_prompt_generation_prompt(
        self,
        brief: BackgroundGenerationRequest
    ) -> str:
        """Build the prompt for OpenAI to generate background prompts."""
        product_name = brief.product_name
        target_audience = brief.target_audience
        emotional_tones = ", ".join(brief.emotional_tone) if brief.emotional_tone else "neutral"
        visual_keywords = ", ".join(brief.visual_style_keywords) if brief.visual_style_keywords else ""
        key_messages = "\n".join(f"- {msg}" for msg in brief.key_messages) if brief.key_messages else ""
        
        prompt = f"""You are a creative director generating background image prompts for a product video.

Product: {product_name}
Target Audience: {target_audience}
Emotional Tones: {emotional_tones}
Visual Style Keywords: {visual_keywords}
Key Messages:
{key_messages}

Generate 6 DISTINCT background image prompts that would be suitable for scenes in a video (16:9 aspect ratio). Each prompt should:
1. Describe a complete background scene/environment
2. Be visually distinct from the others
3. Reflect the product context, audience, and emotional tone
4. Be suitable for a vertical video format
5. Include specific details about the setting, lighting, atmosphere, and style

Examples of good prompts:
- "Interior of a historic mansion with ornate chandeliers, warm golden lighting, elegant furniture, cinematic composition"
- "Modern minimalist office space with floor-to-ceiling windows, natural daylight, clean lines, professional atmosphere"
- "Cozy coffee shop interior with warm lighting, wooden furniture, plants, inviting and comfortable ambiance"

Return your response as a JSON object with a "prompts" array containing exactly 6 strings. Each string should be a complete, detailed background description prompt.

Return ONLY valid JSON in this format: {{"prompts": ["prompt 1", "prompt 2", ...]}}, no markdown formatting, no code blocks."""
        
        return prompt
    
    async def _generate_prompts_with_openai(self, prompt: str) -> str:
        """Call OpenAI API to generate background prompts."""
        try:
            # Select model based on environment
            if settings.OPENAI_MODEL:
                model = settings.OPENAI_MODEL
            elif settings.is_development():
                model = "gpt-3.5-turbo"
            else:
                model = "gpt-4o"
            
            # Run the synchronous OpenAI call in a thread pool
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert creative director specializing in background image generation. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.8,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content.strip()
            
            # Handle potential markdown code blocks
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            
            return content.strip()
            
        except Exception as e:
            raise RuntimeError(f"Failed to generate prompts with OpenAI: {str(e)}")
    
    def _parse_prompt_response(self, response: str) -> List[str]:
        """Parse OpenAI response into list of prompt strings."""
        import json
        
        try:
            data = json.loads(response)
            
            if isinstance(data, dict):
                if "prompts" in data:
                    prompts = data["prompts"]
                else:
                    prompts = list(data.values())
            elif isinstance(data, list):
                prompts = data
            else:
                raise ValueError("Unexpected response format")
            
            # Validate prompts are strings
            valid_prompts = [str(p) for p in prompts if p]
            
            return valid_prompts[:6]  # Return up to 6 prompts
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse prompt response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to structure prompts: {str(e)}")
    
    async def _generate_images_parallel(
        self,
        prompts: List[str]
    ) -> List[Optional[str]]:
        """Generate images in parallel using google/nano-banana-pro."""
        if not self.replicate_service:
            raise ValueError("Replicate service not available")
        
        # Create tasks for parallel generation
        tasks = [
            self._generate_single_background_image(prompt)
            for prompt in prompts
        ]
        
        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        image_urls = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Background image {idx + 1} generation failed: {str(result)}")
                image_urls.append(None)
            else:
                image_urls.append(result)
        
        return image_urls
    
    async def _generate_single_background_image(self, prompt: str) -> Optional[str]:
        """Generate a single background image using google/nano-banana-pro."""
        try:
            if not self.replicate_service:
                raise ValueError("Replicate service not available")
            
            # Use nano-banana-pro for background generation
            # JSON structure matches the specified format
            # Using 16:9 aspect ratio for all project images
            input_params = {
                "prompt": prompt,
                "resolution": "1K",
                "image_input": [],
                "aspect_ratio": "16:9",
                "output_format": "png",
                "safety_filter_level": "block_only_high"
            }
            
            # Call nano-banana-pro via Replicate
            client = self.replicate_service.client
            output = await asyncio.to_thread(
                client.run,
                "google/nano-banana-pro",
                input=input_params
            )
            
            # Extract image URL from output
            if not output:
                raise Exception("No output from nano-banana-pro")
            
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
            
            logger.info(f"Generated background image: {image_url[:50]}...")
            return image_url
            
        except Exception as e:
            logger.error(f"Failed to generate background image: {str(e)}")
            return None


# Singleton instance
_background_service: Optional[BackgroundAssetService] = None

def get_background_service() -> BackgroundAssetService:
    """Get or create background service singleton."""
    global _background_service
    if _background_service is None:
        _background_service = BackgroundAssetService()
    return _background_service

