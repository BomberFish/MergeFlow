import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config"
import fs from "fs";

import terminal from "terminal-kit";
const term = terminal.terminal;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
	model: "gemini-2.0-flash-exp"
});
const prompt = "Solve any git merge conflicts in the file below. Only respond with the final file contents, but do not use markdown code blocks.";

const file = process.argv[0].includes("node") ? process.argv[2] : process.argv[1];

if (file == "-h" || file == "--help") {
	term("Usage: mergeflow index.js <file>\n");
	term.processExit(0);
	process.exit(0);
} if (!file) {
	term.red("Please provide a file to generate content from.");
	term.processExit(1);
	process.exit(1);
} else if (!fs.existsSync(file)) {
	term.red("File does not exist.");
	term.processExit(1);
	process.exit(1);
}

const data = {
	inlineData: {
		data: Buffer.from(fs.readFileSync(file)).toString("base64"),
		mimeType: "text/plain",
	}
}

let spinner = await term.spinner("dotSpinner");
term.green(" Generating...")

const result = await model.generateContent([prompt,data]);
spinner.animate(false);
term.eraseLine();

let cursorLocation = await term.getCursorLocation();
term.moveTo(1, cursorLocation.y);
term(result.response.text());

fs.writeFileSync(file, Buffer.from(result.response.text(), "base64").toString("utf-8"));
term.green("\nFile saved successfully.");
term.processExit(0);