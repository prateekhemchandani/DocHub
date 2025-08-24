// TextEditor.js
import { useCallback, useEffect, useState } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";

const SAVE_INTERVAL_MS = 2000;
const TOOLBAR_OPTIONS = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["bold", "italic", "underline"],
  [{ color: [] }, { background: [] }],
  [{ script: "sub" }, { script: "super" }],
  [{ align: [] }],
  ["image", "blockquote", "code-block"],
  ["clean"],
];

export default function TextEditor() {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState(null);
  const [quill, setQuill] = useState(null);

  // --- Initialize Socket.IO connection ---
  useEffect(() => {
    if (!documentId) return;

    const s = io(process.env.REACT_APP_API_URL, {
      transports: ["websocket"],
    });

    s.on("connect", () => console.log("✅ Socket connected:", s.id));
    s.on("connect_error", (err) => console.error("❌ Socket error:", err));

    setSocket(s);

    return () => s.disconnect();
  }, [documentId]);

  // --- Load document from server ---
  useEffect(() => {
    if (!socket || !quill) return;

    socket.once("load-document", (document) => {
      quill.setContents(document);
      quill.enable();
    });

    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  // --- Auto-save every 2 seconds ---
  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      socket.emit("save-document", { documentId, data: quill.getContents() });
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, quill, documentId]);

  // --- Apply remote changes from other users ---
  useEffect(() => {
    if (!socket || !quill) return;

    const handleReceive = (delta) => quill.updateContents(delta);
    socket.on("receive-changes", handleReceive);

    return () => socket.off("receive-changes", handleReceive);
  }, [socket, quill]);

  // --- Broadcast local user changes ---
  useEffect(() => {
    if (!socket || !quill) return;

    const handleChange = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };

    quill.on("text-change", handleChange);
    return () => quill.off("text-change", handleChange);
  }, [socket, quill]);

  // --- Initialize Quill editor ---
  const wrapperRef = useCallback((wrapper) => {
    if (!wrapper) return;

    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);

    const q = new Quill(editor, {
      theme: "snow",
      modules: { toolbar: TOOLBAR_OPTIONS },
    });

    q.disable();
    q.setText("Loading...");
    setQuill(q);
  }, []);

  return <div className="container" ref={wrapperRef} style={{ height: "100vh" }}></div>;
}
