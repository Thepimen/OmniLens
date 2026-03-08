# 👁️‍🗨️ OmniLens | AI-Powered Video RAG Platform

![Estado: En Desarrollo Activo](https://img.shields.io/badge/Status-Active_Development-success)
![Arquitectura: Microservicios](https://img.shields.io/badge/Architecture-Microservices-blue)
![Stack: Next.js | Node | Python](https://img.shields.io/badge/Stack-Next.js_|_Node_|_Python-black)

OmniLens es una plataforma SaaS de procesamiento de video asíncrono y **Retrieval-Augmented Generation (RAG)**. Permite a los usuarios subir archivos de video pesados (reuniones, podcasts, clases), procesarlos en segundo plano mediante IA, extraer metadatos, transcribir el audio y, en última instancia, "chatear" con el contenido del video.

---

## 🏗️ Arquitectura del Sistema (System Design)

El proyecto está diseñado para ser escalable, separando el manejo de tráfico web del procesamiento pesado de Inteligencia Artificial utilizando un enfoque de microservicios.

1. **Frontend (`/frontend`)**: Next.js (App Router) + Tailwind CSS. Provee la interfaz de usuario para la carga de archivos y visualización de resultados.
2. **API Gateway (`/api-gateway`)**: Node.js + Express. Actúa como el orquestador principal. Recibe los archivos multimedia y encola los trabajos pesados.
3. **Message Broker (Redis)**: Maneja las colas de trabajo (mediante BullMQ) para asegurar que la subida masiva de videos no bloquee la inferencia de la IA.
4. **AI Worker (`/ai-worker`)**: Python + FastAPI. Servicio dedicado a procesar los *jobs* de la cola. Utiliza FFmpeg/OpenCV para extracción de metadatos/keyframes y modelos de OpenAI (Whisper) para la transcripción de audio.

---

## 🚀 Estado Actual (v0.1.0)

Actualmente, el pipeline de procesamiento de datos es capaz de:
- [x] Arquitectura base y comunicación entre microservicios (Health Checks).
- [x] Subida de archivos y encolado de trabajos vía Redis + BullMQ.
- [x] Extracción de metadatos precisos del video (Duración, FPS, Total de Frames).
- [x] Extracción inteligente de *Scene Keyframes* (Fotogramas clave).
- [ ] Transcripción de audio a texto usando Whisper (WIP - Resolviendo dependencias locales FFmpeg).
- [ ] Vectorización de datos (Embeddings) y guardado en Base de Datos Vectorial.
- [ ] Interfaz de Chat con LLM sincronizada con el reproductor de video.

---

## 💻 Tech Stack Detallado

* **Frontend:** Next.js 14, React, Tailwind CSS, Lucide Icons.
* **Backend (Gateway):** Node.js, Express.js, Multer (multipart/form-data), BullMQ.
* **Backend (IA):** Python 3, FastAPI, Whisper (OpenAI), OpenCV.
* **Infraestructura:** Docker (para Redis), Git.

---

## 🛠️ Instalación y Setup Local

Para correr este proyecto en local, necesitas tener instalados **Node.js**, **Python 3.10+**, **Docker** y **FFmpeg** configurado en el PATH de tu sistema.

### 1. Iniciar Redis (Docker)
En la raíz del proyecto, levanta el contenedor de Redis:
```bash
docker-compose up -d