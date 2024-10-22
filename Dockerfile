# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Print Python and pip versions
RUN python --version && pip --version

# Upgrade pip and install wheel
RUN pip install --upgrade pip wheel

# Install required python packages
RUN pip install --no-cache-dir -r requirements.txt -v || \
    (echo "Failed to install requirements. Contents of requirements.txt:" && \
     cat requirements.txt && \
     pip list && \
     pip check && \
     exit 1)

# Create a data directory
RUN mkdir /app/data

# Make port 2210 available to the world outside this container
EXPOSE 2210

# Define environment variable
ENV NAME World

# Run server.py when the container launches
CMD ["python", "server.py"]
