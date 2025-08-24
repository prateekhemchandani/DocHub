require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Document = require("./Document");

const app = express();
const server = http.createServer(app);

// --- Socket.IO setup ---
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB Atlas connection error:", err));

const DEFAULT_VALUE = { ops: [{ insert: "\n" }] }; // Quill empty document format

// --- Socket.IO events ---
io.on("connection", (socket) => {
  console.log("🔗 New client connected:", socket.id);

  // Load document
  socket.on("get-document", async (documentId) => {
    if (!documentId) return;

    try {
      const document = await findOrCreateDoc(documentId);
      socket.join(documentId);
      socket.emit("load-document", document.data);
    } catch (err) {
      console.error("❌ Error loading document:", err);
      socket.emit("load-document", DEFAULT_VALUE);
    }
  });

  // Real-time updates
  socket.on("send-changes", (delta) => {
    const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
    if (rooms.length === 0) return;
    socket.broadcast.to(rooms[0]).emit("receive-changes", delta);
  });

  // Auto-save
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

// --- Helper to find or create document ---
async function findOrCreateDoc(id) {
  if (!id) return null;
  let document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: DEFAULT_VALUE });
}

// --- Optional root route to check server status ---
app.get("/", (req, res) => {
  res.send("📝 Text Editor Backend is running.");
});

// --- Start server ---
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
