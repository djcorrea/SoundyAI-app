// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Carregar variáveis de ambiente
dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Rota raiz
app.get("/", (req, res) => {
  res.send("🚀 Servidor SoundyAI rodando no Railway!");
});

// Importar e registrar todas as rotas da pasta api/
import cancelSubscriptionRoute from "./api/cancel-subscription.js";
import chatBackupRoute from "./api/chat-backup.js";
import chatBrokenRoute from "./api/chat-broken.js";
import chatWithImagesRoute from "./api/chat-with-images.js";
import chatRoute from "./api/chat.js";
import createPreferenceRoute from "./api/create-preference.js";
import deleteAccountRoute from "./api/delete-account.js";
import fase2AdapterRoute from "./api/fase2-adapter.js";
import firebaseAdminDevRoute from "./api/firebaseAdmin.dev.js";
import firebaseAdminRoute from "./api/firebaseAdmin.js";
import mercadopagoRoute from "./api/mercadopago.js";
import uploadAudioRoute from "./api/upload-audio.js";
import uploadImageRoute from "./api/upload-image.js";
import visionExtractRoute from "./api/vision-extract.js";
import voiceMessageRoute from "./api/voice-message.js";
import webhookRoute from "./api/webhook.js";

// Registrar rotas com prefixos
app.use("/api/cancel-subscription", cancelSubscriptionRoute);
app.use("/api/chat-backup", chatBackupRoute);
app.use("/api/chat-broken", chatBrokenRoute);
app.use("/api/chat-with-images", chatWithImagesRoute);
app.use("/api/chat", chatRoute);
app.use("/api/create-preference", createPreferenceRoute);
app.use("/api/delete-account", deleteAccountRoute);
app.use("/api/fase2-adapter", fase2AdapterRoute);
app.use("/api/firebaseAdmin-dev", firebaseAdminDevRoute);
app.use("/api/firebaseAdmin", firebaseAdminRoute);
app.use("/api/mercadopago", mercadopagoRoute);
app.use("/api/upload-audio", uploadAudioRoute);
app.use("/api/upload", uploadImageRoute);
app.use("/api/vision-extract", visionExtractRoute);
app.use("/api/voice", voiceMessageRoute);
app.use("/api/webhook", webhookRoute);

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor SoundyAI rodando na porta ${PORT}`);
});

export default app;
