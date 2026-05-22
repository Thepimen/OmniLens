import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, Column, String, Float, Integer, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from .base import BaseVideoMetadataRepository

Base = declarative_base()

class VideoMetadataModel(Base):
    __tablename__ = 'video_metadata'

    id = Column(String, primary_key=True)
    filename = Column(String, nullable=False)
    duration_seconds = Column(Float, nullable=False)
    fps = Column(Float, nullable=False)
    total_frames = Column(Integer, nullable=False)
    process_time_seconds = Column(Float, nullable=False)
    transcript_text = Column(Text, nullable=False)
    keyframes_json = Column(Text, nullable=False)  # Stores JSON list of keyframe dictionaries
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        try:
            keyframes = json.loads(self.keyframes_json)
        except Exception:
            keyframes = []
        return {
            "id": self.id,
            "filename": self.filename,
            "duration_seconds": self.duration_seconds,
            "fps": self.fps,
            "total_frames": self.total_frames,
            "process_time_seconds": self.process_time_seconds,
            "transcript_text": self.transcript_text,
            "keyframes": keyframes,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class SQLiteVideoMetadataRepository(BaseVideoMetadataRepository):
    """
    Relational database implementation using SQLite + SQLAlchemy.
    To migrate to cloud RDS, simply replace the DATABASE_URL environment variable.
    """
    def __init__(self, db_url: str = None):
        if not db_url:
            db_url = os.getenv("DATABASE_URL")
            if not db_url:
                db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "metadata.db")
                db_url = f"sqlite:///{db_path}"
        
        # Disable same thread restriction for SQLite to run smoothly with multi-threaded FastAPI executors
        connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        self.engine = create_engine(db_url, connect_args=connect_args)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def save(self, video_metadata: Dict[str, Any]) -> Dict[str, Any]:
        session = self.Session()
        try:
            keyframes = video_metadata.get("keyframes", [])
            keyframes_str = json.dumps(keyframes) if isinstance(keyframes, list) else video_metadata.get("keyframes_json", "[]")

            model = VideoMetadataModel(
                id=video_metadata.get("id"),
                filename=video_metadata.get("filename"),
                duration_seconds=video_metadata.get("duration_seconds", 0.0),
                fps=video_metadata.get("fps", 0.0),
                total_frames=video_metadata.get("total_frames", 0),
                process_time_seconds=video_metadata.get("process_time_seconds", 0.0),
                transcript_text=video_metadata.get("transcript_text", ""),
                keyframes_json=keyframes_str
            )
            session.merge(model)
            session.commit()
            return model.to_dict()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def get_by_id(self, video_id: str) -> Optional[Dict[str, Any]]:
        session = self.Session()
        try:
            record = session.query(VideoMetadataModel).filter(VideoMetadataModel.id == video_id).first()
            return record.to_dict() if record else None
        finally:
            session.close()

    def list_all(self) -> List[Dict[str, Any]]:
        session = self.Session()
        try:
            records = session.query(VideoMetadataModel).order_by(VideoMetadataModel.created_at.desc()).all()
            return [r.to_dict() for r in records]
        finally:
            session.close()

    def delete(self, video_id: str) -> bool:
        session = self.Session()
        try:
            record = session.query(VideoMetadataModel).filter(VideoMetadataModel.id == video_id).first()
            if record:
                session.delete(record)
                session.commit()
                return True
            return False
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
