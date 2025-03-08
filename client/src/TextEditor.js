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
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();

  // 🔗 Connect to WebSocket Server
  useEffect(() => {
    const s = io("http://localhost:3001");
    setSocket(s);

    return () => s.disconnect();
  }, []);

  // 📃 Load Document
  useEffect(() => {
    if (!socket || !quill) return;

    socket.once("load-document", (document) => {
      quill.setContents(document);
      quill.enable();
    });

    socket.emit("get-document", documentId);
  }, [socket, quill, documentId]);

  // 💾 Auto-Save Every 2 Seconds
  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      socket.emit("save-document", { documentId, data: quill.getContents() });
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, quill, documentId]);

  // ✏️ Handle Real-Time Updates
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta) => quill.updateContents(delta);
    socket.on("receive-changes", handler);

    return () => socket.off("receive-changes", handler);
  }, [socket, quill]);

  // ✍️ Broadcast User Changes
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };
    quill.on("text-change", handler);

    return () => quill.off("text-change", handler);
  }, [socket, quill]);

  // 📝 Initialize Quill Editor
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

  return <div className="container" ref={wrapperRef}></div>;
}