# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy only backend code and data
COPY app.py .
COPY config.py .
COPY backend/ ./backend/
COPY data/ ./data/

# Expose port (Railway will override with PORT env var)
EXPOSE 5000

# Run the application (backend API only)
CMD ["python", "app.py"]
