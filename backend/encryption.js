const crypto = require("crypto");
const dotenv = require("dotenv");
dotenv.config();
const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const iv = Buffer.from(process.env.ENCRYPTION_IV, "hex");
const encrypt = (text) => {
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted =encrypted+cipher.final("hex");
  return encrypted;
};
const decrypt = (encryptedText) => {
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted =decrypted+decipher.final("utf8");
  return decrypted;
};
module.exports = { encrypt, decrypt };
