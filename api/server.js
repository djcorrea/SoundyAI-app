import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
  res.send("API está rodando 🚀");
});

app.listen(PORT, () => {
  console.log(`API rodando na porta ${PORT}`);
});
