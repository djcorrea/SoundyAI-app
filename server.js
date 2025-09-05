// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 👉 Servir frontend da pasta public
app.use(express.static(path.join(__dirname, "public")));

// Importar e registrar todas as rotas da pasta api/
import cancelSubscriptionRoute from "./api/cancel-subscription.js";
import chatWithImagesRoute from "./api/chat-with-images.js";
import chatRoute from "./api/chat.js";
import createPreferenceRoute from "./api/create-preference.js";
import deleteAccountRoute from "./api/delete-account.js";
import mercadopagoRoute from "./api/mercadopago.js";
import uploadAudioRoute from "./api/upload-audio.js";
import uploadImageRoute from "./api/upload-image.js";
import voiceMessageRoute from "./api/voice-message.js";
import webhookRoute from "./api/webhook.js";

// Registrar rotas com prefixos
app.use("/api/cancel-subscription", cancelSubscriptionRoute);
app.use("/api/chat-with-images", chatWithImagesRoute);
app.use("/api/chat", chatRoute);
app.use("/api/create-preference", createPreferenceRoute);
app.use("/api/delete-account", deleteAccountRoute);
app.use("/api/mercadopago", mercadopagoRoute);
app.use("/api/upload-audio", uploadAudioRoute);
app.use("/api/upload", uploadImageRoute);
app.use("/api/voice", voiceMessageRoute);
app.use("/api/webhook", webhookRoute);

// 👉 Rota raiz: abre landing.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

// 👉 Fallback: só dispara se não achar nenhum arquivo existente
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next(); // não intercepta API
  res.status(404).sendFile(path.join(__dirname, "public", "landing.html"));
});


// Iniciar servidor
const PORT = process.env.PORT || 8080; // Railway geralmente força 8080
app.listen(PORT, () => {
  console.log(`🚀 Servidor SoundyAI rodando na porta ${PORT}`);
});

export default app;
