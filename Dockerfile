# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Create a data directory
RUN mkdir /app/data

# Make port 2210 available to the world outside this container
EXPOSE 2210

# Define environment variable
ENV NAME World

# Run server.py when the container launches
CMD ["python", "server.py"]
