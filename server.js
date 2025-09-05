// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 👉 Servir todos arquivos da pasta public normalmente
app.use(express.static(path.join(__dirname, "public")));

// Rotas explícitas (não dependem de fallback)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "landing.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// APIs
import cancelSubscriptionRoute from "./api/cancel-subscription.js";
import chatRoute from "./api/chat.js";
import mercadopagoRoute from "./api/mercadopago.js";
import webhookRoute from "./api/webhook.js";
import deleteAccountRoute from "./api/delete-account.js";
import uploadAudioRoute from "./api/upload-audio.js";
import uploadImageRoute from "./api/upload-image.js";
import voiceMessageRoute from "./api/voice-message.js";
import chatWithImagesRoute from "./api/chat-with-images.js";

app.use("/api/cancel-subscription", cancelSubscriptionRoute);
app.use("/api/chat", chatRoute);
app.use("/api/mercadopago", mercadopagoRoute);
app.use("/api/webhook", webhookRoute);
app.use("/api/delete-account", deleteAccountRoute);
app.use("/api/upload-audio", uploadAudioRoute);
app.use("/api/upload", uploadImageRoute);
app.use("/api/voice", voiceMessageRoute);
app.use("/api/chat-with-images", chatWithImagesRoute);

// ❌ Nenhum fallback pra index.html — só serve o que existe na pasta public

// Iniciar servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor SoundyAI rodando na porta ${PORT}`);
});

export default app;
