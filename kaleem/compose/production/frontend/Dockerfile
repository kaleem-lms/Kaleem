# Stage 1: Build React App
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json ./

# Copy source code
COPY . .

# Install dependencies
RUN npm install

# Build the React app
RUN npm run build

# Stage 2: Serve App with Nginx
FROM nginx:alpine

# Copy the build output to the Nginx HTML directory
COPY --from=build /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/nginx.conf

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
