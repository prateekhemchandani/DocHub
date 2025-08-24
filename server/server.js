require("dotenv").config(); // 1. Load environment variables
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const path = require("path"); // 2. Needed to serve React build
const Document = require("./Document");

const app = express();
const server = http.createServer(app);

// 3. Socket.IO configuration
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
    }
});

// 4. MongoDB connection using environment variable
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch(err => console.error("❌ MongoDB Atlas connection error:", err));

const defaultValue = "";

// 5. WebSocket Connection
io.on("connection", (socket) => {
    console.log("🔗 New client connected:", socket.id);

    socket.on("get-document", async (documentId) => {
        if (!documentId) return;
        try {
            const document = await findOrCreateDoc(documentId);
            socket.join(documentId);
            socket.emit("load-document", document?.data || defaultValue);
        } catch (err) {
            console.error("❌ Error loading document:", err);
            socket.emit("load-document", defaultValue);
        }
    });

    socket.on("send-changes", (delta) => {
        const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
        if (rooms.length === 0) return;

        const documentId = rooms[0];
        socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async ({ documentId, data }) => {
        if (!documentId) return;
        try {
            await Document.findByIdAndUpdate(documentId, { data }, { upsert: true });
        } catch (err) {
            console.error("❌ Error saving document:", err);
        }
    });

    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
    });
});

// 6. Helper to find or create document in MongoDB
async function findOrCreateDoc(id) {
    if (!id) return null;
    let document = await Document.findById(id);
    if (document) return document;
    return await Document.create({ _id: id, data: defaultValue });
}

// 7. Serve React frontend in production
// if (process.env.NODE_ENV === "production") {
//     app.use(express.static(path.join(__dirname, "client/build")));

//     app.get("*", (req, res) => {
//         res.sendFile(path.join(__dirname, "client/build", "index.html"));
//     });
// }

// 8. Start server using environment PORT
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
