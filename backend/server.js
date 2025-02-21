const express=require("express");
const mongoose=require("mongoose");
const jwt=require("jsonwebtoken");
const bodyParser=require("body-parser");
const dotenv=require("dotenv");
const axios=require("axios");
const pdfParse=require("pdf-parse");  
const {encrypt,decrypt}=require("./encryption");
dotenv.config();
const app=express();
app.use(bodyParser.json());

const applicationSchema=new mongoose.Schema({
  name:String,
  email:String,
  education:{
    degree:String,
    branch:String,
    institution:String,
    year:String,
  },
  experience:{
    job_title:String,
    company:String,
  },
  skills:[String],
  summary:String,
});
const Applicant=mongoose.model("Applicant",applicationSchema);

app.post("/auth",(req,res)=>{
  const {username,password}=req.body;
  if(username ==="naval.ravikant" && password==="05111974") {
    const token=jwt.sign({username},process.env.JWT_SECRET,{ expiresIn:"1h"});
    return res.status(200).json({ JWT:token});
  } else {
    return res.status(401).json({ error:"Invalid credentials" });
  }
});

const verifyToken=(req,res,next)=>{
  const authHeader=req.headers.authorization;
  if (!authHeader){
    return res.status(401).json({ error:"No token provided"});
  }
  const authParts=authHeader.split(" ");
  if(authParts.length!== 2 ||authParts[0] !== "Bearer") {
    return res.status(401).json({ error:"Invalid token format"});
  }
  const token=authParts[1];
  jwt.verify(token,process.env.JWT_SECRET,(error,decoded) => {
    if(error){
      return res.status(401).json({error:"Invalid token"});
    }
    req.user=decoded;
    next();
  });
};

app.post("/enrichresume", verifyToken, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({error: "No URL provided" });
  }

  try {
    const response = await axios({
        url,
        responseType: "arraybuffer",
     });
     const contentType=response.headers["content-type"]
    const data = await pdfParse(response.data);
    const raw_text= data.text;
    if(!raw_text || raw_text.trim().length===0 || contentType!=="application/pdf"){
      return res.status(500).json({error:"Invalid file type or no text data is detected"})
    }
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extract the following details from the given resume text and return in strict JSON format.
                  Return only valid JSON without any additional text:
                  ${JSON.stringify({
                    name: "string",
                    email: "string",
                    education: {
                      degree: "string",
                      branch: "string",
                      institution: "string",
                      year: "number"
                    },
                    experience: {
                      job_title: "string",
                      company: "string",
                      start_date: "string",
                      end_date: "string"
                    },
                    skills: ["string"],
                    summary: "string"
                  })}
                  Resume Text: ${raw_text}`,
              },
            ],
          },
        ],
      },
      { headers:{"Content-Type":"application/json"}}
    );

    const responseText=geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText){
      return res.status(500).json({ error: "Invalid response from AI service" });
    }

    let parsedData;
    try {
      parsedData=JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));
    } catch (pE){
      return res.status(500).json({ error:"Failed to parse AI response",details:pE.message });
    }
    const applicant = new Applicant({
      name: encrypt(parsedData.name),
      email: encrypt(parsedData.email),
      education: parsedData.education,
      experience: parsedData.experience,
      skills: parsedData.skills,
      summary: parsedData.summary,
    });
    await applicant.save();
    res.status(200).json({ message: "Resume saved successfully", id: applicant._id });
  } catch (err) {
    console.error("Error processing resume:", err.message);
    res.status(500).json({ error: "Error processing resume" });
  }
});

app.post("/searchresume", verifyToken, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(404).json({ error: "Name is required" });
  }
  try {
    const tokens = name.trim().split(/\s+/);
    let pattern = "";
    for (const token of tokens) {
      pattern = pattern + `(?=.*${token})`;
    }
    const regex = new RegExp(pattern, "i");
    const applicants = await Applicant.find({});
    const decryptedApplicants = applicants
      .map((applicant) => ({
        ...applicant._doc,
        name: decrypt(applicant.name),
        email: decrypt(applicant.email),
      }))
      .filter((applicant) => regex.test(applicant.name));
    if (decryptedApplicants.length === 0) {
      return res.status(404).json({ error: "No resumes found" });
    }
    res.status(200).json(decryptedApplicants);
  } catch (err) {
    console.error("Error searching resume:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

mongoose
  .connect(process.env.MONGO)
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log("Listening on port 4000 and connected to DB");
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });

module.exports = app;
