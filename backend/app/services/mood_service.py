"""Mood generation service for extracting distinct visual style directions from creative briefs."""
from typing import List, Dict, Any
from openai import OpenAI
from app.config import settings


class MoodGenerationService:
    """Service for generating distinct mood boards from creative briefs."""
    
    def __init__(self):
        """Initialize the mood generation service with OpenAI client."""
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None
    
    async def generate_mood_directions(
        self, 
        creative_brief: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate 3 distinct visual style directions (moods) from a creative brief.
        
        Args:
            creative_brief: Dictionary containing creative brief data with keys:
                - product_name: str
                - target_audience: str
                - emotional_tone: List[str]
                - visual_style_keywords: List[str]
                - key_messages: List[str]
        
        Returns:
            List of 3 mood dictionaries, each containing:
                - id: str (unique identifier)
                - name: str (mood name)
                - description: str (detailed description)
                - style_keywords: List[str] (visual style keywords)
                - color_palette: List[str] (suggested colors)
                - aesthetic_direction: str (overall aesthetic)
        """
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")
        
        # Build prompt for mood generation
        prompt = self._build_mood_generation_prompt(creative_brief)
        
        # Call OpenAI to generate mood directions
        response = await self._generate_moods_with_openai(prompt)
        
        # Parse and validate the response
        moods = self._parse_mood_response(response)
        
        # Ensure we have exactly 3 distinct moods
        if len(moods) != 3:
            raise ValueError(f"Expected 3 moods, got {len(moods)}")
        
        return moods
    
    def _build_mood_generation_prompt(self, creative_brief: Dict[str, Any]) -> str:
        """Build the prompt for OpenAI to generate mood directions."""
        product_name = creative_brief.get("product_name", "")
        target_audience = creative_brief.get("target_audience", "")
        emotional_tones = ", ".join(creative_brief.get("emotional_tone", []))
        visual_keywords = ", ".join(creative_brief.get("visual_style_keywords", []))
        key_messages = "\n".join(f"- {msg}" for msg in creative_brief.get("key_messages", []))
        
        prompt = f"""You are a creative director analyzing a product brief to generate 3 distinct visual mood board directions.

Product: {product_name}
Target Audience: {target_audience}
Emotional Tones: {emotional_tones}
Visual Style Keywords: {visual_keywords}
Key Messages:
{key_messages}

Generate 3 DISTINCT visual style directions that represent different aesthetic approaches while staying true to the brand and target audience. Each mood should:
1. Have a unique visual identity and aesthetic direction
2. Appeal to the target audience but from different angles
3. Incorporate the emotional tones and visual keywords in different ways
4. Be suitable for a 30-second vertical video (9:16 aspect ratio)

Return your response as a JSON object with a "moods" array containing exactly 3 objects. Each object must have:
- "name": A short, descriptive name for the mood (e.g., "Minimalist Elegance", "Bold & Dynamic", "Warm & Inviting")
- "description": A detailed 2-3 sentence description of the visual style and aesthetic
- "style_keywords": An array of 5-7 visual style keywords specific to this mood
- "color_palette": An array of 3-5 color names or hex codes that represent this mood
- "aesthetic_direction": A one-sentence summary of the overall aesthetic approach

Ensure the 3 moods are distinctly different from each other while all being appropriate for the product and audience.

Return ONLY valid JSON in this format: {{"moods": [{{...}}, {{...}}, {{...}}]}}, no markdown formatting, no code blocks."""
        
        return prompt
    
    async def _generate_moods_with_openai(self, prompt: str) -> str:
        """Call OpenAI API to generate mood directions."""
        import asyncio
        try:
            # Select model based on environment
            # GPT-3.5-turbo is ~10x cheaper than GPT-4o and sufficient for development
            if settings.OPENAI_MODEL:
                model = settings.OPENAI_MODEL
            elif settings.is_development():
                model = "gpt-3.5-turbo"  # Cheaper for development
            else:
                model = "gpt-4o"  # Higher quality for production
            
            # Run the synchronous OpenAI call in a thread pool
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert creative director specializing in visual mood board creation. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.8,  # Higher temperature for more creative variation
                max_tokens=1500,
                response_format={"type": "json_object"}  # Use JSON mode for structured output
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
            raise RuntimeError(f"Failed to generate moods with OpenAI: {str(e)}")
    
    def _parse_mood_response(self, response: str) -> List[Dict[str, Any]]:
        """Parse OpenAI response into structured mood dictionaries."""
        import json
        
        try:
            # Try to parse as JSON
            data = json.loads(response)
            
            # Handle different response formats
            if isinstance(data, dict):
                # If it's a dict, check for common keys
                if "moods" in data:
                    moods = data["moods"]
                elif "directions" in data:
                    moods = data["directions"]
                else:
                    # Try to extract array from dict values
                    moods = list(data.values()) if data else []
            elif isinstance(data, list):
                moods = data
            else:
                raise ValueError("Unexpected response format")
            
            # Validate and structure moods
            structured_moods = []
            for idx, mood in enumerate(moods[:3]):  # Take only first 3
                if not isinstance(mood, dict):
                    continue
                
                structured_mood = {
                    "id": f"mood-{idx + 1}",
                    "name": mood.get("name", f"Mood {idx + 1}"),
                    "description": mood.get("description", ""),
                    "style_keywords": mood.get("style_keywords", []),
                    "color_palette": mood.get("color_palette", []),
                    "aesthetic_direction": mood.get("aesthetic_direction", "")
                }
                
                structured_moods.append(structured_mood)
            
            # If we don't have 3 moods, generate fallback moods
            while len(structured_moods) < 3:
                idx = len(structured_moods)
                structured_moods.append({
                    "id": f"mood-{idx + 1}",
                    "name": f"Style Direction {idx + 1}",
                    "description": "A distinct visual style direction for this product.",
                    "style_keywords": [],
                    "color_palette": [],
                    "aesthetic_direction": "A unique aesthetic approach."
                })
            
            return structured_moods[:3]
            
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse mood response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to structure moods: {str(e)}")

