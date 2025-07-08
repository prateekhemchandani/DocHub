const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Document = require("./Document"); // Ensure your Mongoose model is correct

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Adjust for production
        methods: ["GET", "POST"],
    },
});

// MongoDB 
mongoose.connect("mongodb+srv://khemchandaniprateek:texty123@cluster0.r4ohi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Atlas connection error:", err));

const defaultValue = "";

// WebSocket Connection
io.on("connection", (socket) => {
    console.log("🔗 New client connected:", socket.id);

    // Create load Document
    socket.on("get-document", async (documentId) => {
        try {
            if (!documentId) return;
            const document = await findOrCreateDoc(documentId);
            socket.join(documentId);
            socket.emit("load-document", document?.data || defaultValue);
        } catch (err) {
            console.error("❌ Error loading document:", err);
            socket.emit("load-document", defaultValue);
        }
    });

    // Text Changes
    socket.on("send-changes", (delta) => {
        const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
        if (rooms.length === 0) return;

        const documentId = rooms[0];
        socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    //  Save 
    socket.on("save-document", async ({ documentId, data }) => {
        if (!documentId) return;
        try {
            await Document.findByIdAndUpdate(documentId, { data }, { upsert: true });
        } catch (err) {
            console.error("❌ Error saving document:", err);
        }
    });

    // Disconnection
    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
    });
});

// doc MongoDB
async function findOrCreateDoc(id) {
    if (!id) return null;
    let document = await Document.findById(id);
    if (document) return document;
    return await Document.create({ _id: id, data: defaultValue });
}

server.listen(3001, () => {
    console.log("🚀 Server running on port 3001");
});
