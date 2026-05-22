# OmniLens Production Cloud Deployment Guide

This guide describes the production-grade, highly available, and scalable cloud architecture for **OmniLens**. As Solutions Architect and CTO, our target topology leverages modern managed cloud services (primarily AWS and Supabase) to guarantee low latency, robust data persistence, and secure compute resources.

---

## 1. Cloud Architecture Blueprint

The diagram below represents the production-ready target architecture:

```mermaid
graph TD
    Client[Web Browser / Client]
    
    subgraph "Frontend Layer"
        Vercel[Vercel / AWS Amplify CDN]
    end
    
    subgraph "Application Gateway Layer (AWS App Runner / ECS Fargate)"
        Gateway[Node.js API Gateway]
        ALB[Application Load Balancer]
    end
    
    subgraph "AI Core & RAG Processing (AWS ECS Fargate)"
        Worker[Python AI Worker + FFmpeg]
    end
    
    subgraph "Data & Queue Persistence"
        Redis[AWS ElastiCache for Redis]
        RDS[Supabase or AWS RDS PostgreSQL + pgvector]
    end

    Client -->|HTTPS / WSS| Vercel
    Vercel -->|REST / WebSockets| ALB
    ALB --> Gateway
    Gateway -->|BullMQ Queue| Redis
    Worker -->|Process Jobs| Redis
    Gateway -->|Internal REST| Worker
    Worker -->|Relational History & pgvector| RDS
```

### Component Mapping & Services:

1.  **Frontend**: Next.js App deployed on **Vercel** or **AWS Amplify**. 
    *   *Benefits*: Instant global CDN edge serving, static file optimization, and automatic scale-to-zero serverless SSR.
2.  **API Gateway**: Node.js Express container running on **AWS App Runner** or **AWS ECS Fargate** behind an Application Load Balancer (ALB).
    *   *Benefits*: Fully-managed HTTPS endpoints, autoscaling on CPU/Memory usage, and seamless WebSocket connection persistence.
3.  **AI Worker**: Python FastAPI container running on **AWS ECS Fargate**.
    *   *Benefits*: Fargate allows launching compute tasks on demand. Since the AI Worker performs CPU-heavy Whisper and OpenCV frame extraction, Fargate scales container instances independently of the Gateway.
4.  **Database Layer**: **Supabase PostgreSQL** or **AWS RDS PostgreSQL** with the `pgvector` extension enabled.
    *   *Benefits*: Eliminates the limits of local SQLite/ChromaDB. Fully relational video history tracking mapped side-by-side with high-precision vector embeddings in one secure database.
5.  **Queue & Caching**: **AWS ElastiCache for Redis**.
    *   *Benefits*: High-throughput, sub-millisecond in-memory cache running as the backbone for BullMQ job scheduling between API Gateway and AI Worker.

---

## 2. Infrastructure Setup & Environment Variables

### Environment Configuration Reference

To migrate from local SQLite and ChromaDB to cloud persistence, supply these environment variables to the containers:

#### AI Worker Environment Variables
```env
# Database Configuration (PostgreSQL with pgvector)
DATABASE_URL=postgresql://postgres:your-db-password@your-db-host:5432/postgres

# Vector DB provider switch (toggled to supabase/pgvector)
VECTOR_DB_PROVIDER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key

# LLM Providers (Secure Keys)
GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-proj-...

# Redis Queue Connection
REDIS_HOST=your-elasticache-cluster.cache.amazonaws.com
REDIS_PORT=6379
```

#### API Gateway Environment Variables
```env
PORT=4000
REDIS_HOST=your-elasticache-cluster.cache.amazonaws.com
REDIS_PORT=6379
AI_WORKER_URL=http://ai-worker-service.local:8000
```

#### Frontend Environment Variables
```env
# Client-side gateway connection pointer
NEXT_PUBLIC_API_URL=https://api.omnilens.yourdomain.com
```

---

## 3. Step-by-Step Production Deployment on AWS

### Step 1: Database Setup (Postgres + pgvector)
1.  **Spin up RDS**: Provision an AWS RDS PostgreSQL instance (PostgreSQL 15+ is recommended).
2.  **Enable pgvector**: Connect to the DB using a tool like pgAdmin or psql and execute:
    ```sql
    CREATE EXTENSION IF NOT EXISTS vector;
    ```
3.  *Alternative (Supabase)*: Create a free or pro tier project on [Supabase](https://supabase.com). The pgvector extension is pre-installed. Navigate to the SQL Editor and run `CREATE EXTENSION IF NOT EXISTS vector;` if not already active.

### Step 2: Caching Setup (AWS ElastiCache Redis)
1.  Navigate to the AWS Console -> **Amazon ElastiCache** -> Redis OSS.
2.  Create a new Cluster. Choose a small instance size (e.g., `cache.t4g.micro`) to minimize cost during staging, and scale up for production.
3.  Ensure the security group allows inbound traffic on port `6379` from the ECS security group.

### Step 3: Build & Push Container Images to ECR
Create AWS Elastic Container Registry (ECR) repositories for the services and push the built Docker images:

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <your-aws-account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build & Tag AI Worker
docker build -t omnilens-ai-worker ./ai-worker
docker tag omnilens-ai-worker:latest <your-aws-account-id>.dkr.ecr.us-east-1.amazonaws.com/omnilens-ai-worker:latest
docker push <your-aws-account-id>.dkr.ecr.us-east-1.amazonaws.com/omnilens-ai-worker:latest

# Build & Tag API Gateway
docker build -t omnilens-api-gateway ./api-gateway
docker tag omnilens-api-gateway:latest <your-aws-account-id>.dkr.ecr.us-east-1.amazonaws.com/omnilens-api-gateway:latest
docker push <your-aws-account-id>.dkr.ecr.us-east-1.amazonaws.com/omnilens-api-gateway:latest
```

### Step 4: Deploy API Gateway & AI Worker on ECS Fargate
1.  **Create an ECS Cluster**: Create a standard serverless cluster on AWS ECS using AWS Fargate.
2.  **Mount EFS (Shared Storage)**: Since the API Gateway and the AI Worker need to share processed frame JPEG folders and video files, create an **AWS EFS (Elastic File System)** volume. In the ECS Task Definition, configure both containers to mount the EFS volume at `/uploads`.
3.  **Task Definitions**:
    *   Configure CPU/RAM bounds.
    *   Expose port `4000` on the API Gateway task and configure an ALB to load-balance WebSocket and HTTPS traffic.
    *   Expose port `8000` on the AI Worker task. Use ECS Service Discovery (e.g., `ai-worker-service.local`) so the API Gateway can locate it internally inside the VPC.
4.  **Autoscaling**: Configure ECS Auto Scaling rules based on CPU utilization (> 70% scales up instances).

### Step 5: Deploy Frontend on Vercel
1.  Push the `frontend` directory to a GitHub repository.
2.  Import the repository into **Vercel** (`https://vercel.com`).
3.  Configure the root directory to `frontend`.
4.  Under Environment Variables, add `NEXT_PUBLIC_API_URL` pointing to your AWS Application Load Balancer domain (e.g., `https://api.omnilens.yourdomain.com`).
5.  Click Deploy. Vercel compiles the React 19 app and distributes it across its edge network.

---

## 4. Run Production Build Locally

To test this high-performance multi-container system on your local machine using the production Docker images:

1.  **Configure Environment**:
    Create a `.env` file in the root directory (or ensure your environment variables are configured):
    ```env
    GROQ_API_KEY=your_actual_groq_api_key
    OPENAI_API_KEY=your_actual_openai_api_key
    ```
2.  **Spin up Services**:
    Run the following command:
    ```bash
    docker-compose -f docker-compose.prod.yml up --build
    ```
3.  **Access the Application**:
    *   **Frontend UI**: `http://localhost:3000`
    *   **Express API Gateway**: `http://localhost:4000`
    *   **FastAPI AI Worker**: `http://localhost:8001`
    *   **Redis CLI**: `http://localhost:6379`

This mirrors the identical container environment that runs in cloud orchestration, allowing you to debug and verify system health prior to cloud commits.
