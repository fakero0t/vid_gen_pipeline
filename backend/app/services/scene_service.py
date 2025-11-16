"""Scene generation service for creating scene breakdowns from creative briefs and moods."""
from typing import Dict, Any
from openai import OpenAI
from app.config import settings


class SceneGenerationService:
    """Service for generating scene breakdowns for 30-second videos."""

    def __init__(self):
        """Initialize the scene generation service with OpenAI client."""
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

    async def generate_scene_breakdown(
        self,
        creative_brief: Dict[str, Any],
        selected_mood: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate a scene-by-scene breakdown for a 30-second video.

        Args:
            creative_brief: Dictionary containing creative brief data with keys:
                - product_name: str
                - target_audience: str
                - emotional_tone: List[str]
                - visual_style_keywords: List[str]
                - key_messages: List[str]
            selected_mood: Dictionary containing selected mood data with keys:
                - mood_id: str
                - mood_name: str
                - mood_style_keywords: List[str]
                - mood_color_palette: List[str]
                - mood_aesthetic_direction: str

        Returns:
            Dictionary containing:
                - total_duration: float (30 seconds)
                - scenes: List[Dict] with scene_number, duration, description, style_prompt
        """
        if not self.openai_client:
            raise ValueError("OpenAI API key not configured")

        # Build prompt for scene generation
        prompt = self._build_scene_generation_prompt(creative_brief, selected_mood)

        # Call OpenAI to generate scene breakdown
        response = await self._generate_scenes_with_openai(prompt)

        # Parse and validate the response
        scene_plan = self._parse_scene_response(response)

        # Validate scene count and duration
        if not (5 <= len(scene_plan["scenes"]) <= 7):
            raise ValueError(f"Expected 5-7 scenes, got {len(scene_plan['scenes'])}")

        total_duration = sum(scene["duration"] for scene in scene_plan["scenes"])
        if not (29.0 <= total_duration <= 31.0):
            raise ValueError(f"Total duration must be approximately 30 seconds, got {total_duration}")

        return scene_plan

    def _build_scene_generation_prompt(
        self,
        creative_brief: Dict[str, Any],
        selected_mood: Dict[str, Any]
    ) -> str:
        """Build the prompt for OpenAI to generate scene breakdown."""
        product_name = creative_brief.get("product_name", "")
        target_audience = creative_brief.get("target_audience", "")
        emotional_tones = ", ".join(creative_brief.get("emotional_tone", []))
        key_messages = "\n".join(f"- {msg}" for msg in creative_brief.get("key_messages", []))

        mood_name = selected_mood.get("mood_name", "")
        mood_aesthetic = selected_mood.get("mood_aesthetic_direction", "")
        mood_style_keywords = ", ".join(selected_mood.get("mood_style_keywords", []))
        mood_colors = ", ".join(selected_mood.get("mood_color_palette", []))

        prompt = f"""You are a video creative director creating a scene-by-scene breakdown for a 30-second vertical video (9:16 aspect ratio).

Product: {product_name}
Target Audience: {target_audience}
Emotional Tones: {emotional_tones}
Key Messages:
{key_messages}

Selected Visual Mood: {mood_name}
Aesthetic Direction: {mood_aesthetic}
Style Keywords: {mood_style_keywords}
Color Palette: {mood_colors}

Create a compelling 30-second video breakdown with 5-7 scenes that:

1. **Follow storytelling best practices:**
   - Opening hook (3-4 seconds): Grab attention immediately
   - Product introduction (4-6 seconds): Establish what this is about
   - Key features/benefits (12-16 seconds): Core content, split into 2-3 scenes
   - Closing/CTA (4-6 seconds): Strong finish with call-to-action setup

2. **Scene variety:** Include different shot types (close-up, wide angle, detail shots, dramatic compositions)

3. **Visual consistency:** All scenes must match the selected mood's aesthetic and style

4. **Timing:** Each scene duration must be realistic (3-7 seconds each), and all scenes MUST sum to exactly 30 seconds

5. **Descriptions:** Each scene description should be concise (1-2 sentences) but specific enough to guide visual generation

Return your response as a JSON object with this EXACT structure:
{{
  "total_duration": 30,
  "scenes": [
    {{
      "scene_number": 1,
      "duration": 4.0,
      "description": "Concise description of what happens visually in this scene",
      "style_prompt": "Specific style keywords for this scene matching the mood aesthetic"
    }},
    // ... 4-6 more scenes
  ]
}}

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting, no code blocks
- Ensure scene_number starts at 1 and increments
- Ensure all durations are floats and sum to exactly 30.0
- Include 5-7 scenes total
- Make each scene visually distinct but cohesive with the overall mood"""

        return prompt

    async def _generate_scenes_with_openai(self, prompt: str) -> str:
        """Call OpenAI API to generate scene breakdown."""
        import asyncio
        try:
            # Use GPT-4o for both environments (as per user preference)
            model = settings.OPENAI_MODEL if settings.OPENAI_MODEL else "gpt-4o"

            # Run the synchronous OpenAI call in a thread pool
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert video creative director specializing in short-form social media video production. Always respond with valid JSON only."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,  # Balanced creativity and consistency
                max_tokens=2000,
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
            raise RuntimeError(f"Failed to generate scene breakdown with OpenAI: {str(e)}")

    def _parse_scene_response(self, response: str) -> Dict[str, Any]:
        """Parse OpenAI response into structured scene plan dictionary."""
        import json

        try:
            # Parse as JSON
            data = json.loads(response)

            # Validate structure
            if not isinstance(data, dict):
                raise ValueError("Response must be a JSON object")

            if "scenes" not in data:
                raise ValueError("Response missing 'scenes' array")

            scenes = data["scenes"]
            if not isinstance(scenes, list):
                raise ValueError("'scenes' must be an array")

            # Structure and validate scenes
            structured_scenes = []
            for idx, scene in enumerate(scenes):
                if not isinstance(scene, dict):
                    continue

                # Ensure required fields
                structured_scene = {
                    "scene_number": scene.get("scene_number", idx + 1),
                    "duration": float(scene.get("duration", 0)),
                    "description": scene.get("description", ""),
                    "style_prompt": scene.get("style_prompt", "")
                }

                # Validate scene data
                if structured_scene["duration"] <= 0:
                    raise ValueError(f"Scene {idx + 1} has invalid duration: {structured_scene['duration']}")
                if not structured_scene["description"]:
                    raise ValueError(f"Scene {idx + 1} missing description")

                structured_scenes.append(structured_scene)

            # Calculate total duration
            total_duration = sum(scene["duration"] for scene in structured_scenes)

            return {
                "total_duration": total_duration,
                "scenes": structured_scenes
            }

        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse scene response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to structure scene plan: {str(e)}")
