FROM node:20-bullseye

# Instalar FFmpeg e dependências de áudio
RUN apt-get update && apt-get install -y \
    ffmpeg \
    sox \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Verificar instalação do FFmpeg
RUN ffmpeg -version

WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar resto do projeto
COPY . .

# Criar diretório uploads
RUN mkdir -p /app/uploads

# Expor porta
EXPOSE 8080

# Comando de inicialização
CMD ["node", "server.js"]
