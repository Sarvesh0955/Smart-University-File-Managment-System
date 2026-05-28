import axios from "axios";
import FormData from "form-data";
import fs from "fs";

async function test() {
  try {
    const loginRes = await axios.post("http://localhost:5001/api/auth/login", {
      email: "admin@academichub.com", password: "Admin@123"
    });
    const token = loginRes.data.token;
    
    const form = new FormData();
    form.append("files", fs.createReadStream("/Users/sarvesh0955/Coding/WebD/ai-document-manager/package.json"));
    form.append("subjectId", "test");
    form.append("category", "NOTES");

    const res = await axios.post("http://localhost:3000/api/resources/upload", form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      }
    });
    console.log(res.status, res.data);
  } catch (err) {
    console.error("Error:", err.message);
    if (err.response) console.error(err.response.data);
  }
}
test();
