# Use Node.js as the base image
FROM node:20

# Set the working directory in the container
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Expose the development server port
EXPOSE 5173

# Start the development server
CMD ["npm", "run", "dev"]
