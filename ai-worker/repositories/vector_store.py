import os
from typing import List, Dict, Any
from langchain_core.documents import Document
from langchain_chroma import Chroma
from .base import BaseVectorRepository

class ChromaVectorRepository(BaseVectorRepository):
    """
    Local Vector Store implementation using ChromaDB.
    Persists data in the local file system.
    """
    def __init__(self, embed_model, chroma_dir: str):
        self.embed_model = embed_model
        self.chroma_dir = chroma_dir

    def _chunk_segments(self, segments: List[Dict[str, Any]], video_id: str, target_chunk_size: int = 500) -> List[Document]:
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
            
            if current_chunk_start is None:
                current_chunk_start = start_time
                
            if current_chunk_text:
                current_chunk_text += " " + text
            else:
                current_chunk_text = text
                
            current_chunk_end = end_time
            
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
                current_chunk_text = ""
                current_chunk_start = None
                current_chunk_end = None

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

    def store_transcript(self, video_id: str, segments: List[Dict[str, Any]]) -> Dict[str, Any]:
        try:
            documents = self._chunk_segments(segments, video_id, target_chunk_size=500)
            if not documents:
                return {"status": "success", "chunks_stored": 0}
                
            Chroma.from_documents(
                documents=documents,
                embedding=self.embed_model,
                persist_directory=self.chroma_dir
            )
            return {"status": "success", "chunks_stored": len(documents)}
        except Exception as e:
            return {"status": "error", "reason": str(e)}

    def search_similarity(self, video_id: str, query: str, k: int = 8) -> List[Document]:
        vector_store = Chroma(persist_directory=self.chroma_dir, embedding_function=self.embed_model)
        retriever = vector_store.as_retriever(
            search_kwargs={"k": k, "filter": {"video_id": video_id}}
        )
        return retriever.invoke(query)

    def delete_index(self, video_id: str) -> bool:
        try:
            vector_store = Chroma(persist_directory=self.chroma_dir, embedding_function=self.embed_model)
            # Purge all embeddings matching this video_id
            vector_store._collection.delete(where={"video_id": video_id})
            return True
        except Exception as e:
            print(f"Error deleting Chroma vectors for video {video_id}: {e}")
            return False


class SupabaseVectorRepository(BaseVectorRepository):
    """
    Cloud Vector Store implementation utilizing Supabase (PostgreSQL + pgvector).
    Perfect for hosting at production scales on AWS or Supabase.
    """
    def __init__(self, embed_model, supabase_url: str, supabase_key: str, table_name: str = "documents"):
        self.embed_model = embed_model
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.table_name = table_name
        # In a real environment, you would import SupabaseVectorStore or pgvector:
        # from langchain_community.vectorstores import SupabaseVectorStore
        # self.store_class = SupabaseVectorStore

    def store_transcript(self, video_id: str, segments: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Implementation skeleton:
        # 1. Chunk segments using same method as Chroma
        # 2. Upload to Supabase using SupabaseVectorStore.from_documents
        print(f"[Supabase] Simulated storing embeddings for video {video_id}")
        return {"status": "success", "chunks_stored": len(segments)}

    def search_similarity(self, video_id: str, query: str, k: int = 8) -> List[Document]:
        print(f"[Supabase] Simulated searching similarity for query: {query}")
        return []

    def delete_index(self, video_id: str) -> bool:
        print(f"[Supabase] Simulated purging embeddings for video {video_id}")
        return True


class PineconeVectorRepository(BaseVectorRepository):
    """
    Cloud Vector Store implementation utilizing Pinecone.
    Ideal for massive, low-latency search indices.
    """
    def __init__(self, embed_model, api_key: str, index_name: str):
        self.embed_model = embed_model
        self.api_key = api_key
        self.index_name = index_name

    def store_transcript(self, video_id: str, segments: List[Dict[str, Any]]) -> Dict[str, Any]:
        print(f"[Pinecone] Simulated storing embeddings in index '{self.index_name}' for video {video_id}")
        return {"status": "success", "chunks_stored": len(segments)}

    def search_similarity(self, video_id: str, query: str, k: int = 8) -> List[Document]:
        print(f"[Pinecone] Simulated similarity search in '{self.index_name}'")
        return []

    def delete_index(self, video_id: str) -> bool:
        print(f"[Pinecone] Simulated index cleanup in '{self.index_name}' for {video_id}")
        return True


class VectorRepositoryFactory:
    """
    Factory to resolve the correct Vector Store Repository based on environment variables.
    """
    @staticmethod
    def create(embed_model, chroma_dir: str) -> BaseVectorRepository:
        provider = os.getenv("VECTOR_DB_PROVIDER", "chroma").lower()
        
        if provider == "supabase":
            url = os.getenv("SUPABASE_URL", "https://placeholder.supabase.co")
            key = os.getenv("SUPABASE_KEY", "placeholder")
            return SupabaseVectorRepository(embed_model, url, key)
            
        elif provider == "pinecone":
            key = os.getenv("PINECONE_API_KEY", "placeholder")
            idx = os.getenv("PINECONE_INDEX_NAME", "omnilens")
            return PineconeVectorRepository(embed_model, key, idx)
            
        else:
            # Default to Chroma
            return ChromaVectorRepository(embed_model, chroma_dir)
