import os
from typing import List, Dict, Any
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import HumanMessage, AIMessage
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv

from repositories import SQLiteVideoMetadataRepository, VectorRepositoryFactory

# Load environment variables (OPENAI_API_KEY, GROQ_API_KEY)
load_dotenv()

# Setup paths
CHROMA_DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chroma_db")

# Initialize HuggingFace embeddings globally to avoid reloading the model on every request
print("Loading Embeddings Model (all-MiniLM-L6-v2)...")
embed_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
print("Embeddings Model Loaded!")

# Initialize repositories
vector_repo = VectorRepositoryFactory.create(embed_model, CHROMA_DB_DIR)
db_repo = SQLiteVideoMetadataRepository()

# Load Cross-Encoder Re-ranker on startup
try:
    from sentence_transformers import CrossEncoder
    print("Loading Cross-Encoder Re-ranker (ms-marco-MiniLM-L-6-v2)...")
    cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    print("Cross-Encoder Re-ranker Loaded successfully!")
except Exception as e:
    print(f"Failed to load Cross-Encoder, falling back to default similarity. Error: {e}")
    cross_encoder = None


def process_and_store_embeddings(segments: List[Dict[str, Any]], video_id: str):
    """
    Chunks the whisper segments and stores them in the vector repository.
    """
    print(f"[{video_id}] Routing transcript segments to vector store...")
    return vector_repo.store_transcript(video_id, segments)


def format_docs(docs: List[Document]) -> str:
    """Formats retrieved documents to include timestamps for the prompt."""
    formatted = []
    for d in docs:
        start = d.metadata.get("start_time", 0.0)
        # Convert seconds to MM:SS format
        minutes = int(start // 60)
        seconds = int(start % 60)
        time_str = f"[{minutes:02d}:{seconds:02d}]"
        formatted.append(f"Context {time_str}: {d.page_content}")
    return "\n\n".join(formatted)


def ask_video_question(video_id: str, question: str, chat_history: list = None) -> dict:
    """
    Retrieves context for a video_id from vector storage, applies Cross-Encoder Re-ranking,
    and uses LangChain to generate an answer citing exact timestamps, preserving chat history.
    """
    if chat_history is None:
        chat_history = []
        
    try:
        if not os.environ.get("GROQ_API_KEY"):
            return {"status": "error", "reason": "GROQ_API_KEY is missing from .env"}

        # 1. Retrieve initial candidate documents (K=10)
        print(f"[{video_id}] Retrieving context for query: '{question}'...")
        candidate_docs = vector_repo.search_similarity(video_id, question, k=10)
        
        # 2. Perform Cross-Encoder Re-ranking if available
        retrieved_docs = []
        if cross_encoder and candidate_docs:
            print(f"[{video_id}] Applying Cross-Encoder Re-ranking on {len(candidate_docs)} chunks...")
            # Prepare pairs of (query, document_text)
            pairs = [(question, doc.page_content) for doc in candidate_docs]
            scores = cross_encoder.predict(pairs)
            
            # Sort documents by their re-ranking score
            ranked_pairs = sorted(zip(candidate_docs, scores), key=lambda x: x[1], reverse=True)
            
            # Select top m=4 most relevant chunks
            retrieved_docs = [doc for doc, score in ranked_pairs[:4]]
            
            # Print ranked relevance scores for logging
            for doc, score in ranked_pairs[:4]:
                start = doc.metadata.get("start_time", 0.0)
                print(f"   [Re-ranked Score: {score:.4f}] Time: {start}s - Content: {doc.page_content[:50]}...")
        else:
            # Fallback to default vector similarity search (top 4 chunks)
            retrieved_docs = candidate_docs[:4]
            print(f"[{video_id}] Fallback search completed: using {len(retrieved_docs)} chunks.")

        # 3. Conversational Memory: Slide window to keep last 6 messages
        if len(chat_history) > 6:
            print(f"[{video_id}] Pruning chat history to last 6 messages for token efficiency.")
            chat_history = chat_history[-6:]

        # 4. Prepare History Messages for LangChain Prompt
        history_msgs = []
        for msg in chat_history:
            role = msg.get('role')
            content = msg.get('content', msg.get('text', ''))
            if role == 'user':
                history_msgs.append(HumanMessage(content=content))
            elif role == 'assistant':
                history_msgs.append(AIMessage(content=content))
        
        # 5. Prompt Engineering (strict timestamp compliance rule)
        system_prompt = """You are an AI assistant analyzing a video.
Use the following pieces of retrieved context to answer the question. 
The context may contain parts of the video transcript that are relevant to the user's question or the conversation history.
Each piece of context has a timestamp in the format [MM:SS].

CRITICAL RULE: When you use information from a context piece, you MUST cite its exact timestamp in your answer using the format [MM:SS].
Example: "The marketing budget was reduced by 20% [12:34]."

If you don't know the answer, just say that you don't know. Do not invent any facts.

Context:
{context}"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="history"),
            ("human", "{question}")
        ])
        
        # 6. LLM Setup (Groq high-speed cloud endpoint)
        llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0)
        
        # 7. LCEL Generation Chain
        rag_chain = (
            {"context": lambda x: format_docs(retrieved_docs), "question": RunnablePassthrough(), "history": lambda x: history_msgs}
            | prompt
            | llm
            | StrOutputParser()
        )
        
        answer = rag_chain.invoke(question)
        
        # Format sources for debugging and interactive timeline mapping in frontend
        sources = [
            {
                "text": d.page_content,
                "start_time": d.metadata.get("start_time"),
                "end_time": d.metadata.get("end_time")
            } for d in retrieved_docs
        ]
        
        return {
            "status": "success",
            "answer": answer,
            "sources": sources
        }
        
    except Exception as e:
        print(f"[{video_id}] Error in RAG chat pipeline: {e}")
        return {"status": "error", "reason": str(e)}
