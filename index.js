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

// Add initial check for quiet mode
const isQuietMode = process.argv.includes("--quiet");
if (isQuietMode) {
    term.green("Running in quiet mode - changes will be applied automatically\n");
}

async function merge(file) {
	const originalText = fs.readFileSync(file)
	const data = {
		inlineData: {
			data: Buffer.from(originalText).toString("base64"),
			mimeType: "text/plain",
		}
	}

	// Create a frame for the progress
	term.clear();
	term.moveTo(1, 1);
	term.cyan('╭─ MergeFlow ').green('resolving conflicts\n');
	term.cyan('├ File: ').white(file + '\n');
	term.cyan('╰─');

	let spinner = await term.spinner("dotSpinner");

	const result = await model.generateContent([prompt, data]);
	const text = result.response.text();
	spinner.animate(false);

	// Clear the spinner line
	term.previousLine(1);
	term.eraseLine();
	term.cyan('╰─ ').green('✓ Resolution complete\n\n');

	// Show diff with improved formatting
	term.cyan('Changes:\n');
	term.cyan('╭─────────────────────────────\n');
	diffLines(originalText.toString('utf-8'), text).forEach(part => {
		let prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
		let color = part.added ? 'green' : part.removed ? 'red' : 'white';
		term[color](prefix + part.value);
	});
	term.cyan('╰─────────────────────────────\n\n');

	// Improved confirmation dialog
	term.cyan('╭─ Confirm changes\n');
	term.cyan('├ ').white('Press ').cyan('[Y]').white(' to save, ').cyan('[N]').white(' to discard\n');
	term.cyan('╰─ ');

	term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }, function (error, result) {
		if (result || process.argv.includes("--quiet")) {
			fs.writeFileSync(file, Buffer.from(text, "utf-8"));
			term.green("\n✓ Changes saved successfully\n");
			term.processExit(0);
		} else {
			term.red("\n✗ Changes discarded\n");
			term.processExit(0);
		}
	});
}

term("\n\nWould you like to");
term.green(' commit ');
term('the changes? (Y/n) ');
term.yesOrNo({ yes: ['y', 'ENTER'], no: ['n'] }, function (error, result) {
	if (result || process.argv.includes("-y")) {
		exec("git add . && git commit --author='MergeFlow <>' -m 'Automated merge conflict resolution'", (err, stdout, stderr) => {
			if (err) {
				term.red("An error occurred while committing the changes.")
				term.processExit(1);
			}
			term.green("Changes committed successfully.");
			term.processExit(0);
		});
	}
	else {
		term.red("Changes not committed.");
		term.processExit(0);
	}
}); 