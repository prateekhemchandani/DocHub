const mongoose = require("mongoose");
const Document = require("./Document");
const io = require("socket.io")(3001, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    },
});

// ✅ Connect to MongoDB Atlas
mongoose.connect("mongodb+srv://khemchandaniprateek:texty123@cluster0.r4ohi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Atlas connection error:", err));

const defaultValue = "";

io.on("connection", (socket) => {
    console.log("🔗 New client connected:", socket.id);

    // 📃 Load or Create Document
    socket.on("get-document", async (documentId) => {
        try {
            if (!documentId) return;

            const document = await findOrCreateDoc(documentId);
            console.log(`📄 Loaded document ${documentId}:`, document?.data || defaultValue);

            socket.join(documentId);
            socket.emit("load-document", document?.data || defaultValue);
        } catch (err) {
            console.error("❌ Error loading document:", err);
            socket.emit("load-document", defaultValue);
        }
    });

    // ✏️ Handle Text Changes (Broadcast to Others)
    socket.on("send-changes", (delta) => {
        const rooms = Array.from(socket.rooms).filter(room => room !== socket.id);
        if (rooms.length === 0) return;

        const documentId = rooms[0];
        socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    // 💾 Save Document Data
    socket.on("save-document", async ({ documentId, data }) => {
        if (!documentId) return;
        try {
            console.log(`💾 Saving document ${documentId}:`, data); // Debug log
            await Document.findByIdAndUpdate(documentId, { data }, { upsert: true });
            console.log(`✅ Document ${documentId} saved`);
        } catch (err) {
            console.error("❌ Error saving document:", err);
        }
    });

    // 🔌 Handle Disconnection
    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
    });
});

// 📄 Find or Create Document in MongoDB
async function findOrCreateDoc(id) {
    if (!id) return null;

    let document = await Document.findById(id);
    if (document) return document;

    return await Document.create({ _id: id, data: defaultValue });
}
