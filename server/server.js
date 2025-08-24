require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Document = require("./Document");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Atlas connection error:", err));

const DEFAULT_VALUE = { ops: [{ insert: "\n" }] };

// --- Socket.IO events ---
io.on("connection", (socket) => {
  console.log("🔗 New client connected:", socket.id);

  // Load or create document
  socket.on("get-document", async (documentId) => {
    if (!documentId) return;

    const document = await findOrCreateDoc(documentId);
    socket.join(documentId); // join room
    socket.emit("load-document", document.data); // send initial data
  });

  // Broadcast changes to all other users in the same room
  socket.on("send-changes", (delta, documentId) => {
    if (!documentId) return;
    socket.broadcast.to(documentId).emit("receive-changes", delta);
  });

  // Auto-save document
  socket.on("save-document", async ({ documentId, data }) => {
    if (!documentId) return;
    try {
      await Document.findByIdAndUpdate(
        documentId,
        { data },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.error("❌ Error saving document:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// --- Helper ---
async function findOrCreateDoc(id) {
  if (!id) return null;
  let document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: DEFAULT_VALUE });
}

app.get("/", (req, res) => res.send("📝 Text Editor Backend is running."));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
