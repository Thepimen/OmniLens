import os
from typing import List, Dict, Any
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_chroma import Chroma
from langchain_core.prompts import PromptTemplate, ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv

# Load environment variables (OPENAI_API_KEY, GROQ_API_KEY)
load_dotenv()

# We'll store ChromaDB locally in the ai-worker directory for now
CHROMA_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")

# Initialize HuggingFace embeddings globally to avoid reloading the model on every request
# all-MiniLM-L6-v2 is a small, fast, and capable sentence-transformer
embed_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

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
            
        # 2. Store in Chroma using the local HuggingFace embeddings
        vector_store = Chroma.from_documents(
            documents=documents,
            embedding=embed_model,
            persist_directory=CHROMA_DB_DIR
        )
        print(f"[{video_id}] Successfully saved {len(documents)} chunks to ChromaDB at {CHROMA_DB_DIR}")
        
        return {"status": "success", "chunks_stored": len(documents)}
        
    except Exception as e:
        print(f"[{video_id}] Error in RAG pipeline: {e}")
        return {"status": "error", "reason": str(e)}

def format_docs(docs: List[Document]) -> str:
    """Formats retrieved documents to include timestamps for the prompt."""
    formatted = []
    for d in docs:
        start = d.metadata.get("start_time", 0.0)
        # Convert seconds to MM:SS
        minutes = int(start // 60)
        seconds = int(start % 60)
        time_str = f"[{minutes:02d}:{seconds:02d}]"
        formatted.append(f"Context {time_str}: {d.page_content}")
    return "\n\n".join(formatted)

def ask_video_question(video_id: str, question: str, chat_history: list = None) -> dict:
    """
    Retrieves context for a video_id from ChromaDB and uses LangChain LCEL
    to generate an answer citing the exact timestamps, remembering chat_history.
    """
    if chat_history is None:
        chat_history = []
        
    try:
        if not os.environ.get("GROQ_API_KEY"):
            return {"status": "error", "reason": "GROQ_API_KEY is missing from .env"}

        # Connect to existing ChromaDB
        vector_store = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=embed_model)
        
        # 1. Setup Retriever (filter by video_id)
        retriever = vector_store.as_retriever(
            search_kwargs={"k": 4, "filter": {"video_id": video_id}}
        )
        
        # 2. Prepare History Messages
        history_msgs = []
        for msg in chat_history:
            if msg.get('role') == 'user':
                history_msgs.append(HumanMessage(content=msg.get('content')))
            elif msg.get('role') == 'assistant':
                history_msgs.append(AIMessage(content=msg.get('content')))
        
        # 3. Prompt Engineering
        # Strict instructions to use the [MM:SS] format from the formatted docs
        system_prompt = """You are an AI assistant analyzing a video.
Use the following pieces of retrieved context to answer the question. 
The context may contain parts of the video transcript that are relevant to the user's question or the conversation history.
Each piece of context has a timestamp in the format [MM:SS].

CRITICAL RULE: When you use information from a context piece, you MUST cite its exact timestamp in your answer using the format [MM:SS].
Example: "The marketing budget was reduced by 20% [12:34]."

If you don't know the answer, just say that you don't know.

Context:
{context}"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}")
        ])
        
        # 4. LLM Setup - Using Groq's high-speed cloud endpoint
        llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0)
        
        # 5. LCEL Generation Chain
        # We pass history manually via RunnablePassthrough.assign
        rag_chain = (
            {"context": retriever | format_docs, "question": RunnablePassthrough(), "history": lambda x: history_msgs}
            | prompt
            | llm
            | StrOutputParser()
        )
        
        # To also return the sources for debugging/frontend, we invoke the retriever separately
        docs = retriever.invoke(question)
        answer = rag_chain.invoke(question)
        
        sources = [
            {
                "text": d.page_content,
                "start_time": d.metadata.get("start_time"),
                "end_time": d.metadata.get("end_time")
            } for d in docs
        ]
        
        return {
            "status": "success",
            "answer": answer,
            "sources": sources
        }
        
    except Exception as e:
        print(f"[{video_id}] Error in chat pipeline: {e}")
        return {"status": "error", "reason": str(e)}
