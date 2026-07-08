FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY check_availability.py .

RUN mkdir -p /app/data && chown nobody:nogroup /app/data

USER nobody

CMD ["python", "-u", "check_availability.py"]
