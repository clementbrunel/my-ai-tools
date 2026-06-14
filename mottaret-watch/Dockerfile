FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY check_availability.py .

CMD ["python", "-u", "check_availability.py"]
