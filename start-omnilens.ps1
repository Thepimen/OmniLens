Write-Host "Iniciando Base de Datos (Redis via Docker)..." -ForegroundColor Cyan
docker-compose up -d

Write-Host "Iniciando API Gateway (Node.js)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd api-gateway; npm install; npm start"

Write-Host "Iniciando AI Worker (Python)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ai-worker; .\venv\Scripts\activate; pip install -r requirements.txt; python main.py"

Write-Host "Iniciando Frontend (Next.js)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm install; npm run dev"

Write-Host "¡Servicios iniciados! Se han abierto 3 ventanas de consola nuevas para los microservicios." -ForegroundColor Green
pause
