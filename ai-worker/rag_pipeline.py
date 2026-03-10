import os
from typing import List, Dict, Any
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
from dotenv import load_dotenv

# Load environment variables (OPENAI_API_KEY)
load_dotenv()

# We'll store ChromaDB locally in the ai-worker directory for now
CHROMA_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")

def chunk_whisper_segments(segments: List[Dict[str, Any]], video_id: str, target_chunk_size: int = 500) -> List[Document]:
    """
    Takes Whisper segments and smartly groups them into logical chunks
    while preserving the exact start time of the first segment and end time 
    of the last segment in each chunk.
    """
    docs = []
    
    current_chunk_text = ""
    current_chunk_start = None
    current_chunk_end = None
    
    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue
            
        start_time = seg.get("start", 0.0)
        end_time = seg.get("end", 0.0)
        
        # Initialize chunk start time if it's the first segment in the chunk
        if current_chunk_start is None:
            current_chunk_start = start_time
            
        # Append text
        if current_chunk_text:
            current_chunk_text += " " + text
        else:
            current_chunk_text = text
            
        # Always update the end time to the latest segment's end
        current_chunk_end = end_time
        
        # If we reached our target chunk size (in characters), save the document and reset
        if len(current_chunk_text) >= target_chunk_size:
            doc = Document(
                page_content=current_chunk_text,
                metadata={
                    "video_id": video_id,
                    "start_time": round(current_chunk_start, 2),
                    "end_time": round(current_chunk_end, 2)
                }
            )
            docs.append(doc)
            
            # Reset for next chunk
            current_chunk_text = ""
            current_chunk_start = None
            current_chunk_end = None

    # Add any remaining text as the final chunk
    if current_chunk_text:
        doc = Document(
            page_content=current_chunk_text,
            metadata={
                "video_id": video_id,
                "start_time": round(current_chunk_start, 2) if current_chunk_start is not None else 0.0,
                "end_time": round(current_chunk_end, 2) if current_chunk_end is not None else 0.0
            }
        )
        docs.append(doc)
        
    return docs

def process_and_store_embeddings(segments: List[Dict[str, Any]], video_id: str):
    """
    Chunks the whisper segments and stores them in ChromaDB using OpenAI Embeddings.
    """
    try:
        print(f"[{video_id}] Starting embedding process...")
        
        # 1. Chunk the segments
        documents = chunk_whisper_segments(segments, video_id, target_chunk_size=500)
        print(f"[{video_id}] Created {len(documents)} document chunks.")
        
        # 2. Check for OpenAI key
        if not os.environ.get("OPENAI_API_KEY"):
            print(f"[{video_id}] WARNING: OPENAI_API_KEY not found. Skipping embeddings.")
            return {"status": "skipped", "reason": "No OpenAI API Key provided.", "chunks_created": len(documents)}
            
        # 3. Initialize Embeddings
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        
        # 4. Store in Chroma
        vector_store = Chroma.from_documents(
            documents=documents,
            embedding=embeddings,
            persist_directory=CHROMA_DB_DIR
        )
        print(f"[{video_id}] Successfully saved {len(documents)} chunks to ChromaDB at {CHROMA_DB_DIR}")
        
        return {"status": "success", "chunks_stored": len(documents)}
        
    except Exception as e:
        print(f"[{video_id}] Error in RAG pipeline: {e}")
        return {"status": "error", "reason": str(e)}
