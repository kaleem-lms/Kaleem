# Use Node.js as the base image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy only the package.json and lock file to leverage Docker's cache
COPY package*.json  ./

# Install dependencies
RUN npm i

# Copy the rest of the application source code
COPY . .

# Expose the development server port
EXPOSE 5173

CMD ["npm", "run", "dev"]


