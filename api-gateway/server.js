const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Queue, Worker } = require('bullmq');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.json());

// Setup storage
const uploadDir = path.join(__dirname, '..', 'uploads');
const framesDir = path.join(uploadDir, 'frames');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
}

// Serve the extracted frames statically so frontend can access them
app.use('/frames', express.static(framesDir));
// Serve source videos statically so history items can stream directly
app.use('/videos', express.static(uploadDir));


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// BullMQ Setup (environment driven redis connection)
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const connection = { host: REDIS_HOST, port: REDIS_PORT };
const videoQueue = new Queue('video-processing', { connection });
const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:8001';


app.get('/api/health', (req, res) => {
    res.json({ status: 'API Gateway OK' });
});

app.post('/api/upload', upload.single('video'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No video file provided.' });
    }

    try {
        const job = await videoQueue.add('process-video', {
            filePath: req.file.path,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype
        });

        res.json({
            message: 'Video uploaded and queued successfully.',
            jobId: job.id,
            file: req.file.filename
        });

        io.emit('job_queued', { jobId: job.id, filename: req.file.originalname });
    } catch (error) {
        console.error('Queue error:', error);
        res.status(500).json({ error: 'Failed to queue video.' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { video_id, question, chat_history } = req.body;

        if (!video_id || !question) {
            return res.status(400).json({ status: 'error', reason: 'Missing video_id or question' });
        }

        const pythonResponse = await axios.post(`${AI_WORKER_URL}/api/chat`, {
            video_id,
            question,
            chat_history: chat_history || []
        });

        res.json(pythonResponse.data);
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ status: 'error', reason: 'Failed to communicate with AI Worker for chat' });
    }
});

app.get('/api/videos', async (req, res) => {
    try {
        const pythonResponse = await axios.get(`${AI_WORKER_URL}/api/videos`);
        res.json(pythonResponse.data);
    } catch (error) {
        console.error('List videos error:', error.message);
        res.status(500).json({ status: 'error', reason: 'Failed to retrieve video history from AI Worker' });
    }
});

app.get('/api/videos/:id', async (req, res) => {
    try {
        const pythonResponse = await axios.get(`${AI_WORKER_URL}/api/videos/${req.params.id}`);
        res.json(pythonResponse.data);
    } catch (error) {
        console.error('Get video error:', error.message);
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ status: 'error', reason: 'Video not found in history' });
        }
        res.status(500).json({ status: 'error', reason: 'Failed to retrieve video details from AI Worker' });
    }
});

app.delete('/api/videos/:id', async (req, res) => {
    try {
        const pythonResponse = await axios.delete(`${AI_WORKER_URL}/api/videos/${req.params.id}`);
        res.json(pythonResponse.data);
    } catch (error) {
        console.error('Delete video error:', error.message);
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ status: 'error', reason: 'Video not found in history' });
        }
        res.status(500).json({ status: 'error', reason: 'Failed to delete video from AI Worker' });
    }
});


// BullMQ Worker to process jobs
const worker = new Worker('video-processing', async job => {
    io.emit('job_processing', { jobId: job.id, progress: 10, message: 'Starting AI analysis' });

    try {
        // Forward the file path to python worker to simulate heavy processing
        io.emit('job_processing', { jobId: job.id, progress: 30, message: 'Extracting audio & frames' });

        const pythonResponse = await axios.post(`${AI_WORKER_URL}/worker/process`, {
            filePath: job.data.filePath,
            jobId: job.id
        });

        io.emit('job_processing', { jobId: job.id, progress: 90, message: 'Compiling RAG Metadata' });
        return pythonResponse.data;
    } catch (error) {
        console.error('AI Worker error:', error.message);
        throw new Error('Failed to communicate with AI Worker');
    }
}, { connection });

worker.on('completed', (job, returnvalue) => {
    console.log(`Job ${job.id} has completed!`);
    io.emit('job_completed', { jobId: job.id, result: returnvalue });
});

worker.on('failed', (job, err) => {
    console.log(`Job ${job.id} has failed with ${err.message}`);
    io.emit('job_failed', { jobId: job.id, error: err.message });
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
});
