FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Expose default Expo dev port
EXPOSE 8081

CMD ["npx", "expo", "start"]
