const fs = require("fs");
const axios = require("axios");
const pdfParse = require("pdf-parse");

async function extractTextFromPDF(url) {
    try {
        // Download the PDF file
        const response = await axios({
            url,
            responseType: "arraybuffer",
        });

        // Parse the PDF content
        const data = await pdfParse(response.data);
        
        console.log("Extracted Text:\n", data.text);
    } catch (error) {
        console.error("Error extracting text:", error);
    }
}

const pdfUrl = "https://www.dhli.in/uploaded_files/resumes/resume_3404.pdf";
extractTextFromPDF(pdfUrl);
