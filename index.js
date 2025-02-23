import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config"
import fs from "fs";
import { exec, execSync } from "child_process";
import terminal from "terminal-kit";
import { diffLines } from "diff";
const term = terminal.terminal;


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
	model: "gemini-2.0-flash-exp"
});
const prompt = "Solve any git merge conflicts in the file below. Only respond with the final file contents, but do not use markdown code blocks. Ensure that the file is in a valid state after the merge.";

if (!fs.existsSync(".git")) {
	term.red("Not a git repository.");
	term.processExit(1);
	process.exit(1);
}

const status = execSync("git status --porcelain").toString();
const files = status.split("\n").filter(line => line.includes("U")).map(line => line.split(" ")[1]);

if (files.length == 0) {
	term.green("No merge conflicts found. Awesome!");
	term.processExit(0);
	process.exit(0);
} else {
	files.forEach(file => {
		merge(file);
	});
}


async function merge(file) {
	const originalText = fs.readFileSync(file)
	const data = {
		inlineData: {
			data: Buffer.from(originalText).toString("base64"),
			mimeType: "text/plain",
		}
	}

	let spinner = await term.spinner("dotSpinner");
	term.green(` Resolving ${file.split("/").at(-1)}`);

	const result = await model.generateContent([prompt, data]);
	const text = result.response.text();
	spinner.animate(false);

	async function eraseLine() {
		term.eraseLine();
		let cursorLocation = await term.getCursorLocation();
		term.moveTo(1, cursorLocation.y);
	}

	await eraseLine();
	term('✓');
	term.green(` Successfully resolved ${file.split("/").at(-1)}.\n`);

	diffLines(originalText.toString('utf-8'), text).forEach(part => {
		let color = part.added ? 'green' : part.removed ? 'red' : 'grey';
		term[color](part.added ? "+" : part.removed ? "-" : " ", part.value + "\n");
	});

	// term(result.response.text());

	term('\n\nWould you like to overwrite the file? (Y/n) ');
	term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }, function (error, result) {
		if (result || process.argv.includes("-y")) {
			fs.writeFileSync(file, Buffer.from(text, "utf-8"));
			term.green("\nFile saved successfully.");
			term.processExit(0);
		}
		else {
			term.red("\nFile not saved.");
			term.processExit(0);
		}
	});
}