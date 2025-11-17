"""FFmpeg service for video composition and processing."""
import os
import tempfile
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import ffmpeg
from pathlib import Path
import httpx
import hashlib
from datetime import datetime


class FFmpegCompositionService:
    """Service for composing final videos using FFmpeg."""

    # Target specifications
    TARGET_WIDTH = 1080  # 9:16 aspect ratio
    TARGET_HEIGHT = 1920
    TARGET_FPS = 30
    TARGET_DURATION = 30  # seconds
    TARGET_MAX_SIZE_MB = 50
    CROSSFADE_DURATION = 0.5  # seconds

    def __init__(self, temp_dir: Optional[str] = None):
        """
        Initialize FFmpeg composition service.

        Args:
            temp_dir: Optional temporary directory for file operations
        """
        self.temp_dir = temp_dir or tempfile.gettempdir()
        self.work_dir = Path(self.temp_dir) / "video_composition"
        self.work_dir.mkdir(exist_ok=True, parents=True)

    async def download_file(self, url: str, destination: Path) -> bool:
        """
        Download a file from URL to destination.

        Args:
            url: URL to download from
            destination: Path to save the file

        Returns:
            True if successful, False otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.get(url)
                response.raise_for_status()

                with open(destination, "wb") as f:
                    f.write(response.content)

                print(f"✓ Downloaded: {destination.name}")
                return True

        except Exception as e:
            print(f"✗ Failed to download {url}: {str(e)}")
            return False

    async def download_clips_and_audio(
        self,
        video_clips: List[Dict[str, Any]],
        audio_url: Optional[str] = None
    ) -> Tuple[List[Path], Optional[Path]]:
        """
        Download all video clips and audio file in parallel.

        Args:
            video_clips: List of video clip data with URLs
            audio_url: Optional audio URL

        Returns:
            Tuple of (list of video paths, audio path)
        """
        # Create unique job directory
        job_id = hashlib.md5(f"{datetime.utcnow().isoformat()}".encode()).hexdigest()[:8]
        job_dir = self.work_dir / job_id
        job_dir.mkdir(exist_ok=True, parents=True)

        print(f"\n📥 Downloading {len(video_clips)} video clips and audio...")

        # Prepare download tasks
        download_tasks = []
        video_paths = []

        # Download video clips
        for idx, clip in enumerate(video_clips):
            video_url = clip.get("video_url")
            if not video_url:
                print(f"⚠ Warning: Clip {idx + 1} has no video URL, skipping")
                continue

            # Determine file extension from URL or default to .mp4
            ext = ".mp4"
            if "." in video_url.split("/")[-1]:
                url_ext = "." + video_url.split(".")[-1].split("?")[0]
                if url_ext in [".mp4", ".mov", ".avi", ".webm"]:
                    ext = url_ext

            video_path = job_dir / f"clip_{idx:03d}{ext}"
            video_paths.append(video_path)
            download_tasks.append(self.download_file(video_url, video_path))

        # Download audio if provided
        audio_path = None
        if audio_url:
            # Determine audio extension
            audio_ext = ".mp3"
            if "." in audio_url.split("/")[-1]:
                url_ext = "." + audio_url.split(".")[-1].split("?")[0]
                if url_ext in [".mp3", ".wav", ".m4a", ".aac"]:
                    audio_ext = url_ext

            audio_path = job_dir / f"audio{audio_ext}"
            download_tasks.append(self.download_file(audio_url, audio_path))

        # Execute all downloads in parallel
        results = await asyncio.gather(*download_tasks, return_exceptions=True)

        # Check for failures
        video_results = results[:len(video_paths)]
        successful_videos = [
            path for path, success in zip(video_paths, video_results)
            if success is True and path.exists()
        ]

        if audio_url and len(results) > len(video_paths):
            audio_success = results[-1]
            if audio_success is not True or not audio_path.exists():
                print("⚠ Warning: Audio download failed")
                audio_path = None

        print(f"✓ Downloaded {len(successful_videos)}/{len(video_clips)} video clips")
        if audio_path:
            print(f"✓ Downloaded audio file")

        return successful_videos, audio_path

    def get_video_duration(self, video_path: Path) -> float:
        """
        Get the duration of a video file in seconds.

        Args:
            video_path: Path to video file

        Returns:
            Duration in seconds
        """
        try:
            probe = ffmpeg.probe(str(video_path))
            duration = float(probe['format']['duration'])
            return duration
        except Exception as e:
            print(f"⚠ Warning: Could not probe video duration for {video_path.name}: {e}")
            return 0.0

    def _check_has_audio(self, video_path: Path) -> bool:
        """
        Check if a video file has audio streams.

        Args:
            video_path: Path to video file

        Returns:
            True if video has audio, False otherwise
        """
        try:
            probe = ffmpeg.probe(str(video_path))
            # Check if any stream is audio
            for stream in probe.get('streams', []):
                if stream.get('codec_type') == 'audio':
                    return True
            return False
        except Exception as e:
            print(f"⚠ Warning: Could not probe video for audio: {e}")
            return False

    def create_clip_list_file(self, video_paths: List[Path], output_path: Path) -> Path:
        """
        Create a file list for FFmpeg concat demuxer.

        Args:
            video_paths: List of video file paths
            output_path: Path to save the list file

        Returns:
            Path to the created list file
        """
        list_file = output_path.parent / "clip_list.txt"
        with open(list_file, "w") as f:
            for video_path in video_paths:
                f.write(f"file '{video_path.absolute()}'\n")
        return list_file

    async def compose_video(
        self,
        video_clips: List[Dict[str, Any]],
        audio_url: Optional[str] = None,
        output_filename: Optional[str] = None,
        include_crossfade: bool = True,
        target_bitrate: Optional[str] = None
    ) -> Optional[Path]:
        """
        Compose final video from clips with audio and transitions.

        Args:
            video_clips: List of video clip data (must include video_url)
            audio_url: Optional background music URL
            output_filename: Optional custom output filename
            include_crossfade: Whether to include crossfade transitions
            target_bitrate: Optional target video bitrate (e.g., "2M", "3M")

        Returns:
            Path to composed video or None if failed
        """
        print("\n🎬 Starting video composition...")

        try:
            # Download all files
            video_paths, audio_path = await self.download_clips_and_audio(
                video_clips, audio_url
            )

            if not video_paths:
                print("✗ No video clips to compose")
                return None

            # Generate output filename
            if not output_filename:
                timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
                output_filename = f"composed_video_{timestamp}.mp4"

            output_path = self.work_dir / output_filename

            # Calculate durations
            clip_durations = [self.get_video_duration(path) for path in video_paths]
            total_duration = sum(clip_durations)

            # Calculate crossfade overlap
            num_transitions = len(video_paths) - 1
            total_crossfade_time = num_transitions * self.CROSSFADE_DURATION if include_crossfade else 0
            final_duration = total_duration - total_crossfade_time

            print(f"📊 Composition details:")
            print(f"   - {len(video_paths)} clips, total duration: {total_duration:.1f}s")
            print(f"   - Crossfade transitions: {num_transitions} × {self.CROSSFADE_DURATION}s")
            print(f"   - Final duration: {final_duration:.1f}s")

            # Compose video based on whether crossfade is needed
            if include_crossfade and len(video_paths) > 1:
                composed_path = await self._compose_with_crossfade(
                    video_paths, clip_durations, output_path, target_bitrate
                )
            else:
                composed_path = await self._compose_simple_concat(
                    video_paths, output_path, target_bitrate
                )

            if not composed_path or not composed_path.exists():
                print("✗ Video composition failed")
                return None

            # Add audio if provided
            if audio_path and audio_path.exists():
                print("\n🎵 Adding background music...")
                final_path = output_path.parent / f"final_{output_path.name}"
                success = await self._add_audio_to_video(
                    composed_path, audio_path, final_path, final_duration
                )
                if success and final_path.exists():
                    # Remove intermediate file
                    composed_path.unlink()
                    composed_path = final_path
                else:
                    print("⚠ Warning: Audio mixing failed, using video without audio")

            # Check file size
            file_size_mb = composed_path.stat().st_size / (1024 * 1024)
            print(f"\n✅ Video composition complete!")
            print(f"   - Output: {composed_path.name}")
            print(f"   - Size: {file_size_mb:.2f} MB")
            print(f"   - Duration: {final_duration:.1f}s")

            # Warn if over target size
            if file_size_mb > self.TARGET_MAX_SIZE_MB:
                print(f"⚠ Warning: File size ({file_size_mb:.2f} MB) exceeds target ({self.TARGET_MAX_SIZE_MB} MB)")

            return composed_path

        except Exception as e:
            print(f"✗ Video composition failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    async def _compose_simple_concat(
        self,
        video_paths: List[Path],
        output_path: Path,
        target_bitrate: Optional[str] = None
    ) -> Optional[Path]:
        """
        Concatenate videos without transitions using concat demuxer.

        Args:
            video_paths: List of video file paths
            output_path: Output file path
            target_bitrate: Optional target bitrate

        Returns:
            Path to output file or None if failed
        """
        try:
            # Check if clips have audio
            has_audio = self._check_has_audio(video_paths[0])
            if has_audio:
                print("🔗 Concatenating clips with audio (no transitions)...")
            else:
                print("🔗 Concatenating video-only clips (no transitions)...")

            # Create file list for concat
            list_file = self.create_clip_list_file(video_paths, output_path)

            # Build FFmpeg command
            bitrate = target_bitrate or "2500k"  # Default to 2.5 Mbps

            # Use concat demuxer for simple concatenation
            if has_audio:
                # Clips have audio
                await asyncio.to_thread(
                    lambda: (
                        ffmpeg
                        .input(str(list_file), format='concat', safe=0)
                        .output(
                            str(output_path),
                            vcodec='libx264',
                            video_bitrate=bitrate,
                            acodec='aac',
                            audio_bitrate='192k',
                            s=f'{self.TARGET_WIDTH}x{self.TARGET_HEIGHT}',
                            r=self.TARGET_FPS,
                            preset='medium',
                            pix_fmt='yuv420p'
                        )
                        .overwrite_output()
                        .run(capture_stdout=True, capture_stderr=True)
                    )
                )
            else:
                # Video-only clips (no audio)
                await asyncio.to_thread(
                    lambda: (
                        ffmpeg
                        .input(str(list_file), format='concat', safe=0)
                        .output(
                            str(output_path),
                            vcodec='libx264',
                            video_bitrate=bitrate,
                            s=f'{self.TARGET_WIDTH}x{self.TARGET_HEIGHT}',
                            r=self.TARGET_FPS,
                            preset='medium',
                            pix_fmt='yuv420p'
                        )
                        .overwrite_output()
                        .run(capture_stdout=True, capture_stderr=True)
                    )
                )

            print("✓ Concatenation complete")
            return output_path

        except ffmpeg.Error as e:
            print(f"✗ FFmpeg error during concatenation:")
            print(e.stderr.decode() if e.stderr else str(e))
            return None
        except Exception as e:
            print(f"✗ Error during concatenation: {str(e)}")
            return None

    async def _compose_with_crossfade(
        self,
        video_paths: List[Path],
        clip_durations: List[float],
        output_path: Path,
        target_bitrate: Optional[str] = None
    ) -> Optional[Path]:
        """
        Compose video with crossfade transitions between clips.

        Args:
            video_paths: List of video file paths
            clip_durations: List of clip durations in seconds
            output_path: Output file path
            target_bitrate: Optional target bitrate

        Returns:
            Path to output file or None if failed
        """
        try:
            print("🎞️  Composing with crossfade transitions...")

            # Check if clips have audio streams
            has_audio = self._check_has_audio(video_paths[0])
            if has_audio:
                print("   ✓ Clips have audio streams")
            else:
                print("   ℹ Clips are video-only (no audio)")

            # Build complex filter for crossfade
            # This will create a filter chain that crossfades between clips
            inputs = [ffmpeg.input(str(path)) for path in video_paths]

            bitrate = target_bitrate or "2500k"

            if len(inputs) == 2:
                # Simple case: 2 clips with 1 crossfade
                offset = clip_durations[0] - self.CROSSFADE_DURATION

                video = (
                    ffmpeg
                    .filter([inputs[0].video, inputs[1].video], 'xfade',
                            transition='fade',
                            duration=self.CROSSFADE_DURATION,
                            offset=offset)
                )

                # Mix audio streams only if they exist
                if has_audio:
                    audio = ffmpeg.filter([inputs[0].audio, inputs[1].audio], 'concat', n=2, v=0, a=1)
                else:
                    audio = None

            else:
                # Multiple clips: chain crossfades
                # Start with first clip
                current_video = inputs[0].video
                offset = 0

                for i in range(1, len(inputs)):
                    offset += clip_durations[i-1] - self.CROSSFADE_DURATION
                    current_video = ffmpeg.filter(
                        [current_video, inputs[i].video],
                        'xfade',
                        transition='fade',
                        duration=self.CROSSFADE_DURATION,
                        offset=offset
                    )

                video = current_video

                # Concatenate all audio streams only if they exist
                if has_audio:
                    audio = ffmpeg.filter(
                        [inp.audio for inp in inputs],
                        'concat',
                        n=len(inputs),
                        v=0,
                        a=1
                    )
                else:
                    audio = None

            # Output with scaling and encoding
            if audio:
                # Video with audio
                output = ffmpeg.output(
                    video, audio,
                    str(output_path),
                    vcodec='libx264',
                    video_bitrate=bitrate,
                    acodec='aac',
                    audio_bitrate='192k',
                    s=f'{self.TARGET_WIDTH}x{self.TARGET_HEIGHT}',
                    r=self.TARGET_FPS,
                    preset='medium',
                    pix_fmt='yuv420p'
                ).overwrite_output()
            else:
                # Video only (no audio)
                output = ffmpeg.output(
                    video,
                    str(output_path),
                    vcodec='libx264',
                    video_bitrate=bitrate,
                    s=f'{self.TARGET_WIDTH}x{self.TARGET_HEIGHT}',
                    r=self.TARGET_FPS,
                    preset='medium',
                    pix_fmt='yuv420p'
                ).overwrite_output()

            # Run FFmpeg
            await asyncio.to_thread(
                lambda: output.run(capture_stdout=True, capture_stderr=True)
            )

            print("✓ Crossfade composition complete")
            return output_path

        except ffmpeg.Error as e:
            print(f"✗ FFmpeg error during crossfade:")
            print(e.stderr.decode() if e.stderr else str(e))
            return None
        except Exception as e:
            print(f"✗ Error during crossfade: {str(e)}")
            return None

    async def _add_audio_to_video(
        self,
        video_path: Path,
        audio_path: Path,
        output_path: Path,
        target_duration: float
    ) -> bool:
        """
        Add background audio to video with proper synchronization.

        Args:
            video_path: Path to video file
            audio_path: Path to audio file
            output_path: Output file path
            target_duration: Target duration in seconds

        Returns:
            True if successful, False otherwise
        """
        try:
            # Load video and audio
            video = ffmpeg.input(str(video_path))
            audio = ffmpeg.input(str(audio_path))

            # Trim/loop audio to match video duration
            # Fade out audio at the end for smooth finish
            audio_stream = (
                ffmpeg.filter(audio, 'atrim', duration=target_duration)
                .filter('afade', type='out', start_time=target_duration-1, duration=1)
            )

            # Combine video with new audio (replace existing audio)
            output = (
                ffmpeg
                .output(
                    video.video,
                    audio_stream,
                    str(output_path),
                    vcodec='copy',  # Copy video stream (no re-encoding)
                    acodec='aac',
                    audio_bitrate='192k',
                    shortest=None  # Use shortest stream
                )
                .overwrite_output()
            )

            # Run FFmpeg
            await asyncio.to_thread(
                lambda: output.run(capture_stdout=True, capture_stderr=True)
            )

            print("✓ Audio added successfully")
            return True

        except ffmpeg.Error as e:
            print(f"✗ FFmpeg error adding audio:")
            print(e.stderr.decode() if e.stderr else str(e))
            return False
        except Exception as e:
            print(f"✗ Error adding audio: {str(e)}")
            return False

    def cleanup_job_files(self, job_dir: Path):
        """
        Clean up temporary files for a composition job.

        Args:
            job_dir: Directory containing job files
        """
        try:
            if job_dir.exists() and job_dir.is_dir():
                for file in job_dir.iterdir():
                    if file.is_file():
                        file.unlink()
                job_dir.rmdir()
                print(f"✓ Cleaned up job directory: {job_dir.name}")
        except Exception as e:
            print(f"⚠ Warning: Failed to cleanup {job_dir}: {e}")

    async def optimize_file_size(
        self,
        video_path: Path,
        target_size_mb: float = TARGET_MAX_SIZE_MB
    ) -> Optional[Path]:
        """
        Optimize video file size by adjusting bitrate.

        Args:
            video_path: Path to video file
            target_size_mb: Target size in MB

        Returns:
            Path to optimized video or None if failed
        """
        try:
            # Check current size
            current_size_mb = video_path.stat().st_size / (1024 * 1024)

            if current_size_mb <= target_size_mb:
                print(f"✓ Video already within target size ({current_size_mb:.2f} MB)")
                return video_path

            # Calculate required bitrate reduction
            size_ratio = target_size_mb / current_size_mb
            probe = ffmpeg.probe(str(video_path))
            duration = float(probe['format']['duration'])

            # Calculate new bitrate (80% of theoretical to account for overhead)
            target_bitrate_kbps = int((target_size_mb * 8 * 1024) / duration * 0.8)

            print(f"🗜️  Optimizing file size: {current_size_mb:.2f} MB → {target_size_mb:.2f} MB")
            print(f"   Adjusting bitrate to {target_bitrate_kbps} kbps")

            # Re-encode with lower bitrate
            optimized_path = video_path.parent / f"optimized_{video_path.name}"

            await asyncio.to_thread(
                lambda: (
                    ffmpeg
                    .input(str(video_path))
                    .output(
                        str(optimized_path),
                        vcodec='libx264',
                        video_bitrate=f'{target_bitrate_kbps}k',
                        acodec='aac',
                        audio_bitrate='128k',
                        preset='medium'
                    )
                    .overwrite_output()
                    .run(capture_stdout=True, capture_stderr=True)
                )
            )

            # Verify new size
            new_size_mb = optimized_path.stat().st_size / (1024 * 1024)
            print(f"✓ Optimization complete: {new_size_mb:.2f} MB")

            # Replace original with optimized
            video_path.unlink()
            optimized_path.rename(video_path)

            return video_path

        except Exception as e:
            print(f"✗ File size optimization failed: {str(e)}")
            return video_path  # Return original on failure
