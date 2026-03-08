from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import os
import time
import whisper
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Make sure whisper can find ffmpeg.exe downloaded in this directory
os.environ["PATH"] += os.pathsep + os.path.dirname(os.path.abspath(__file__))

# Initialize Whisper model on startup (using 'tiny' for fast dev response)
print("Loading Whisper Model...")
whisper_model = whisper.load_model("tiny")
print("Whisper Model Loaded!")

app = FastAPI(title="OmniLens AI Worker")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VideoProcessRequest(BaseModel):
    filePath: str
    jobId: str

executor = ThreadPoolExecutor(max_workers=2)

def extract_frames(video_path, output_dir):
    """Extracts 1 frame per second from the video"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    
    saved_frames = []
    
    # Cap extraction to roughly 30 frames max to avoid overloading the UI/server for massive videos
    interval_sec = max(1, int(duration / 30)) if duration > 30 else 1
    
    for sec in range(0, int(duration), interval_sec):
        cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
        success, frame = cap.read()
        if not success:
            continue
            
        frame_filename = f"frame_{sec:04d}.jpg"
        frame_path = os.path.join(output_dir, frame_filename)
        cv2.imwrite(frame_path, frame)
        saved_frames.append({
            "time": sec,
            "path": f"/frames/{os.path.basename(output_dir)}/{frame_filename}"
        })
        
    cap.release()
    return saved_frames

def transcribe_audio(video_path):
    """Uses Whisper to transcribe the audio directly from the video file"""
    try:
        # Whisper can process video files directly (FFmpeg extracts audio under the hood)
        result = whisper_model.transcribe(video_path, fp16=False) # fp16=False for CPU environments
        return result["text"].strip()
    except Exception as e:
        print(f"Transcription error: {e}")
        return f"Transcription unavailable. Error: {str(e)[:50]}"

@app.get("/worker/health")
async def health_check():
    return {"status": "AI Worker OK"}

@app.post("/worker/process")
async def process_video(request: VideoProcessRequest):
    if not os.path.exists(request.filePath):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    try:
        print(f"Starting processing for job {request.jobId}")
        start_time = time.time()
        
        # 1. Base Metadata
        cap = cv2.VideoCapture(request.filePath)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open video file")
            
        fps = round(cap.get(cv2.CAP_PROP_FPS), 2)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = round(total_frames / fps, 2) if fps > 0 else 0
        cap.release()
        
        # 2. Extract Keyframes (1 per second)
        frames_output_dir = os.path.join(os.path.dirname(request.filePath), "frames", request.jobId)
        
        # Run heavy tasks in executor to avoid blocking FastAPI
        loop = asyncio.get_event_loop()
        
        extracted_frames_task = loop.run_in_executor(
            executor, extract_frames, request.filePath, frames_output_dir
        )
        
        transcript_task = loop.run_in_executor(
            executor, transcribe_audio, request.filePath
        )
        
        # Wait for both tasks to complete
        extracted_frames, transcript = await asyncio.gather(
            extracted_frames_task, transcript_task
        )
        
        process_time = round(time.time() - start_time, 2)
        print(f"Finished processing job {request.jobId} in {process_time}s")
        
        return {
            "status": "success",
            "metadata": {
                "duration_seconds": duration,
                "fps": fps,
                "total_frames": total_frames,
                "process_time_seconds": process_time
            },
            "transcript": transcript,
            "keyframes": extracted_frames,
            "message": "AI Processing Complete"
        }
    except Exception as e:
        print(f"Error processing video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
