from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseVideoMetadataRepository(ABC):
    """
    Abstract Interface for managing video analysis metadata in a Relational Database.
    This enables seamless switching between SQLite and production databases like PostgreSQL/AWS RDS.
    """
    @abstractmethod
    def save(self, video_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """Saves or updates a video metadata record."""
        pass

    @abstractmethod
    def get_by_id(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves video metadata by its unique ID."""
        pass

    @abstractmethod
    def list_all(self) -> List[Dict[str, Any]]:
        """Retrieves all stored video records (History)."""
        pass

    @abstractmethod
    def delete(self, video_id: str) -> bool:
        """Deletes a video record by its unique ID."""
        pass


class BaseVectorRepository(ABC):
    """
    Abstract Interface for managing transcript embeddings in a Vector Database.
    This enables switching between local ChromaDB and cloud providers like Supabase pgvector or Pinecone.
    """
    @abstractmethod
    def store_transcript(self, video_id: str, segments: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Smart chunks, embeds, and stores transcript segments in the vector store."""
        pass

    @abstractmethod
    def search_similarity(self, video_id: str, query: str, k: int = 5) -> List[Any]:
        """Retrieves the top k document chunks matching the query, scoped by video_id."""
        pass

    @abstractmethod
    def delete_index(self, video_id: str) -> bool:
        """Deletes all vector embeddings associated with a video_id."""
        pass
