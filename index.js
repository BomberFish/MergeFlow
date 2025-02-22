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

const file = process.argv[2];

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
term.green("\nFile saved successfully.\n");
term.processExit(0);