const { Schema, model } = require("mongoose");

const DocumentSchema = new Schema({
  _id: String,
  data: { type: Object, default: { ops: [{ insert: "\n" }] } },
});

module.exports = model("Document", DocumentSchema);
